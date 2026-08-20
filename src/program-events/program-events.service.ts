import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository, type DeepPartial } from 'typeorm';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { hasEnded } from '../cycles/cycle-dates';
import { Cycle } from '../cycles/cycle.entity';
import { K } from '../i18n';
import { LearningOpportunity } from '../opportunities/learning-opportunity.entity';
import { UnitsService } from '../units/units.service';
import {
  diffInDays,
  isDayWithin,
  isSingleDay,
  isWithinCycle,
  overlaps,
  shiftDay,
} from './event-dates';
import { canUseScope } from './event-scope';
import { ProgramEventOpportunity } from './program-event-opportunity.entity';
import { ProgramEvent } from './program-event.entity';
import type { CreateProgramEventDto } from './dto/create-program-event.dto';
import type { ListProgramEventsDto } from './dto/list-program-events.dto';
import type { RescheduleDto } from './dto/reschedule.dto';
import type { SaveEvaluationDto } from './dto/save-evaluation.dto';
import type { SaveOpportunityPlanDto } from './dto/save-opportunity-plan.dto';
import type { SetOpportunitiesDto } from './dto/set-opportunities.dto';
import type { UpdateProgramEventDto } from './dto/update-program-event.dto';

/** Código que devuelve Postgres al violar un índice único. */
const UNIQUE_VIOLATION = '23505';

/** Mismo patrón que `growth-items.service.ts:15-23`: no inventar uno nuevo. */
function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'driverError' in error &&
    (error as { driverError?: { code?: string } }).driverError?.code ===
      UNIQUE_VIOLATION
  );
}

@Injectable()
export class ProgramEventsService {
  constructor(
    @InjectRepository(ProgramEvent)
    private readonly events: Repository<ProgramEvent>,
    @InjectRepository(ProgramEventOpportunity)
    private readonly links: Repository<ProgramEventOpportunity>,
    @InjectRepository(Cycle)
    private readonly cycles: Repository<Cycle>,
    private readonly unitsService: UnitsService,
    @InjectRepository(LearningOpportunity)
    private readonly opportunities: Repository<LearningOpportunity>,
  ) {}

  /**
   * Esta consulta no cargaba `opportunities`, así que la misma reunión
   * completa medía 100 % en el formulario (`findOne`, que sí trae la
   * relación) y 80 % en la tarjeta de esta columna — no por dos criterios
   * de completitud distintos (`completion()` es una sola función en el
   * cliente), sino porque los dos endpoints devolvían DOS FORMAS
   * DE DATO distintas del mismo evento: una con `opportunities`, la otra
   * sin la clave siquiera. `findAll` ahora carga la misma relación que
   * `findOne`, para que el objeto que mide la columna sea el mismo que mide
   * el formulario — un solo criterio Y un solo dato, no un criterio
   * unificado midiendo dos objetos distintos.
   */
  async findAll(
    user: AuthUser,
    filtros: ListProgramEventsDto,
  ): Promise<ProgramEvent[]> {
    const alcanzables = await this.unidadesAlcanzables(user, filtros.unitId);
    if (alcanzables.length === 0) return [];
    return this.events.find({
      where: {
        isActive: true,
        unitId: In(alcanzables),
        ...(filtros.cycleId ? { cycleId: filtros.cycleId } : {}),
        ...(filtros.kind ? { kind: filtros.kind } : {}),
        ...(filtros.from && filtros.to
          ? { startDate: Between(filtros.from, filtros.to) }
          : {}),
      },
      relations: { opportunities: true },
      order: { startDate: 'ASC', id: 'ASC' },
    });
  }

  async findOne(user: AuthUser, id: string): Promise<ProgramEvent> {
    const evento = await this.events.findOne({
      where: { id },
      relations: { opportunities: true },
    });
    if (!evento || !evento.isActive) {
      throw new AppNotFoundException(K.EVENTS.NOT_FOUND, { id });
    }
    await this.unidadEnAlcance(user, evento.unitId);
    return evento;
  }

  /**
   * Alta de un evento. El DTO ya garantizó la forma —un solo día para las
   * reuniones, alcance coherente, respuestas obligatorias—; lo que se valida
   * acá es lo que necesita ir a la base: el ciclo, su vigencia y el nivel del
   * actor.
   */
  async create(
    user: AuthUser,
    dto: CreateProgramEventDto,
    today: Date = new Date(),
  ): Promise<ProgramEvent> {
    await this.unidadEnAlcance(user, dto.unitId);

    if (!canUseScope(user.accessLevel, dto.scope)) {
      throw new AppForbiddenException(K.EVENTS.SCOPE_NOT_ALLOWED, {
        alcance: dto.scope,
      });
    }

    if (dto.cycleId) {
      await this.validarContraCiclo(
        dto.unitId,
        dto.cycleId,
        dto.startDate,
        dto.endDate,
        today,
      );
    }

    const evento = this.events.create({
      ...dto,
      cycleId: dto.cycleId ?? null,
      isActive: true,
    });
    return this.guardarEvento(evento);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateProgramEventDto,
    today: Date = new Date(),
  ): Promise<ProgramEvent> {
    const evento = await this.findOne(user, id);

    // H6: nadie toca un evento por encima de su nivel, ni siquiera para
    // bajarlo. Se comprueban AMBOS alcances: el que el evento YA tiene (para
    // que un actor de rango bajo no pueda degradar uno ajeno) y el entrante
    // (para que tampoco pueda subirlo por encima de lo que él mismo alcanza).
    this.exigirAlcanceSobre(user, evento);
    if (!canUseScope(user.accessLevel, dto.scope)) {
      throw new AppForbiddenException(K.EVENTS.SCOPE_NOT_ALLOWED, {
        alcance: dto.scope,
      });
    }

    if (dto.cycleId) {
      await this.validarContraCiclo(
        evento.unitId,
        dto.cycleId,
        dto.startDate,
        dto.endDate,
        today,
      );
    }

    const cycleIdNuevo = dto.cycleId ?? null;
    if (cycleIdNuevo !== evento.cycleId) {
      await this.links.delete({ programEventId: id });
    }

    // La unidad no se muda: cambiarla equivaldría a crear otro evento.
    return this.guardarEvento({ ...evento, ...dto, unitId: evento.unitId });
  }

  /**
   * Endpoint del arrastre. Mueve las fechas Y la agenda con ellas, y
   * devuelve los eventos con los que la nueva ubicación se solapa.
   *
   * Los conflictos se informan, no se rechazan: un campamento de grupo encima
   * de una reunión de unidad es algo que el dirigente debe ver, pero puede ser
   * legítimo —el campamento suele crearlo otro rol, más tarde—. Lo único
   * prohibido de veras es que dos reuniones caigan el mismo día, y de eso se
   * encarga el índice único parcial de la base.
   *
   * El DTO de este endpoint solo valida `endDate >= startDate` —no conoce el
   * evento—, así que las reglas 1 y 6 (reunión de un solo día, agenda dentro
   * del rango) se vuelven a exigir aquí. Sin esto, el arrastre podía dejar un
   * evento en un estado que ni `createProgramEventSchema` acepta: el usuario
   * quedaba sin poder volver a guardar el formulario.
   *
   * Antes de este arreglo la agenda se validaba
   * contra el rango nuevo SIN moverse — un momento sembrado con
   * `day = startDate` (`lib/program-events/seed.ts`, fe_ruta) quedaba
   * clavado en la fecha vieja apenas se guardaba una vez, y a partir de ahí
   * CUALQUIER arrastre de ese evento se rechazaba para siempre, aunque el
   * dirigente nunca hubiera tocado la agenda. El arreglo correcto no es
   * relajar la validación: es que el arrastre —una traslación pura, sin
   * ambigüedad sobre qué día le corresponde a cada momento— mueva la agenda
   * el mismo número de días que el evento, igual que se movería un
   * post-it pegado a la tarjeta. Si tras el desplazamiento algún momento
   * sigue fuera del rango nuevo (el rango se acortó), se sigue rechazando
   * como antes: esa validación no desaparece, solo deja de dispararse por
   * el caso en que la respuesta obvia era mover.
   */
  async reschedule(
    user: AuthUser,
    id: string,
    dto: RescheduleDto,
    today: Date = new Date(),
  ): Promise<{ event: ProgramEvent; conflicts: ProgramEvent[] }> {
    const evento = await this.findOne(user, id);
    this.exigirAlcanceSobre(user, evento);

    if (evento.kind === 'reunion' && !isSingleDay(dto.startDate, dto.endDate)) {
      throw new AppBadRequestException(K.EVENTS.SINGLE_DAY_REQUIRED, { id });
    }

    const deltaDias = diffInDays(evento.startDate, dto.startDate);
    const agendaReprogramada = evento.agenda.map((momento) => ({
      ...momento,
      day: shiftDay(momento.day, deltaDias),
    }));

    const momentoFueraDeRango = agendaReprogramada.some(
      (momento) => !isDayWithin(momento.day, dto.startDate, dto.endDate),
    );
    if (momentoFueraDeRango) {
      throw new AppBadRequestException(K.EVENTS.AGENDA_DAY_OUTSIDE_RANGE, {
        id,
      });
    }

    // H1 reaparece aquí: la guarda original era `evento.kind === 'reunion' &&
    // evento.cycleId`, así que una ACTIVIDAD anclada a un ciclo podía
    // arrastrarse fuera de su rango sin que nadie lo notara. La regla es la
    // misma que en create/update: cualquier evento con cycleId respeta su
    // ciclo, sin importar el kind.
    if (evento.cycleId) {
      await this.validarContraCiclo(
        evento.unitId,
        evento.cycleId,
        dto.startDate,
        dto.endDate,
        today,
      );
    }

    const vecinos = await this.events.find({
      where: { unitId: evento.unitId, isActive: true, id: Not(evento.id) },
    });
    const conflicts = vecinos.filter((vecino) =>
      overlaps(dto.startDate, dto.endDate, vecino.startDate, vecino.endDate),
    );

    const guardado = await this.guardarEvento({
      ...evento,
      startDate: dto.startDate,
      endDate: dto.endDate,
      agenda: agendaReprogramada,
    });

    return { event: guardado, conflicts };
  }

  /**
   * H3: el índice único parcial `UX_program_events_reunion_fecha` (regla 3)
   * hace su trabajo en la base, pero un `QueryFailedError` no es una
   * `HttpException` — sin este `catch`, el filtro global lo convierte en 500
   * con `COMMON.INTERNAL_ERROR` y el usuario nunca sabe que debe revertir la
   * tarjeta. Mismo patrón que `growth-items.service.ts:48-60`.
   */
  private async guardarEvento(
    datos: DeepPartial<ProgramEvent>,
  ): Promise<ProgramEvent> {
    try {
      return await this.events.save(datos);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.EVENTS.DATE_TAKEN, {
          unitId: datos.unitId ?? '',
          startDate: datos.startDate
            ? new Date(datos.startDate as unknown as string).toISOString()
            : '',
        });
      }
      throw error;
    }
  }

  /** Baja lógica, como el resto del sistema. */
  async remove(user: AuthUser, id: string): Promise<void> {
    const evento = await this.findOne(user, id);
    this.exigirAlcanceSobre(user, evento);
    await this.events.save({ ...evento, isActive: false });
  }

  /**
   * Regla 15: la evaluación se habilita cuando el evento terminó. `today` entra
   * por parámetro en vez de leerse del reloj para que la regla sea probable sin
   * congelar el tiempo.
   */
  async saveEvaluation(
    user: AuthUser,
    id: string,
    dto: SaveEvaluationDto,
    today: Date = new Date(),
  ): Promise<ProgramEvent> {
    const evento = await this.findOne(user, id);
    this.exigirAlcanceSobre(user, evento);
    if (!hasEnded(evento.endDate, today)) {
      throw new AppBadRequestException(K.EVENTS.EVALUATION_TOO_EARLY, { id });
    }
    return this.events.save({ ...evento, evaluation: dto });
  }

  /**
   * Reemplaza el conjunto vinculado reconciliando contra lo que ya existía: el
   * orden del arreglo es la posición —el índice se persiste, así que
   * reordenar en la interfaz es mandar la lista de nuevo—, pero eso no puede
   * significar borrar y recrear todo. Una oportunidad que sigue en la lista
   * nueva conserva su `plan`; solo se crean de cero las que llegan por
   * primera vez, y solo se borran las que salieron.
   *
   * (Antes se hacía `delete` + recrear todo con `plan: null`: como
   * reordenar dispara este mismo método, cualquier reordenación borraba en
   * silencio la planeación a fondo ya diligenciada de las oportunidades que
   * seguían vinculadas.)
   */
  async setOpportunities(
    user: AuthUser,
    id: string,
    dto: SetOpportunitiesDto,
  ): Promise<ProgramEventOpportunity[]> {
    const evento = await this.findOne(user, id);
    this.exigirAlcanceSobre(user, evento);

    if (evento.kind === 'reunion' && dto.opportunityIds.length === 0) {
      throw new AppBadRequestException(K.EVENTS.OPPORTUNITY_REQUIRED, { id });
    }

    if (dto.opportunityIds.length > 0) {
      const encontradas = await this.opportunities.find({
        where: { id: In(dto.opportunityIds) },
      });
      const invalida = dto.opportunityIds.find((oaId) => {
        const oa = encontradas.find((item) => item.id === oaId);
        return !oa || !oa.isSelected;
      });
      if (invalida) {
        throw new AppBadRequestException(K.EVENTS.OPPORTUNITY_NOT_SELECTED, {
          id: invalida,
        });
      }
      await this.validarCicloDeOportunidades(user, evento, encontradas);
    }

    const actuales = await this.links.find({ where: { programEventId: id } });
    const idsNuevos = new Set(dto.opportunityIds);

    const aBorrar = actuales.filter(
      (link) => !idsNuevos.has(link.learningOpportunityId),
    );
    if (aBorrar.length > 0) {
      await this.links.delete({ id: In(aBorrar.map((link) => link.id)) });
    }

    const reconciliados = dto.opportunityIds.map((oaId, indice) => {
      const existente = actuales.find(
        (link) => link.learningOpportunityId === oaId,
      );
      return existente
        ? { ...existente, position: indice }
        : this.links.create({
            programEventId: id,
            learningOpportunityId: oaId,
            position: indice,
            plan: null,
          });
    });

    if (reconciliados.length === 0) return [];
    return this.links.save(reconciliados);
  }

  /**
   * Las oportunidades vinculadas deben pertenecer al ciclo del evento. Una
   * reunión siempre tiene ciclo (el DTO lo exige), así que ahí la
   * comparación es directa contra `evento.cycleId`.
   *
   * Una actividad suelta no tiene ciclo propio —`evento.cycleId` es nulo—,
   * pero eso NO puede significar "vale cualquier ciclo": sin este chequeo,
   * una actividad podría vincular oportunidades seleccionadas de un ciclo de
   * cualquier unidad del sistema. La regla: todas las oportunidades elegidas
   * deben compartir un único ciclo entre sí, y ese ciclo debe ser de una
   * unidad que el actor alcance —la misma regla de alcance que protege el
   * resto del servicio.
   *
   * H1: el chequeo de alcance vivía SOLO en la rama de `evento.cycleId` nulo,
   * que hacía `return` antes de llegar a `unidadEnAlcance`. Una actividad con
   * el `cycleId` de otra unidad aceptaba sus oportunidades sin más. Ahora
   * ambas ramas terminan en el mismo chequeo: se resuelve primero cuál es el
   * ciclo candidato (el del evento, o el único común entre las oportunidades)
   * y luego, sin excepción, se valida que ese ciclo exista y esté al alcance
   * del actor.
   */
  private async validarCicloDeOportunidades(
    user: AuthUser,
    evento: ProgramEvent,
    encontradas: LearningOpportunity[],
  ): Promise<void> {
    let cycleId = evento.cycleId;

    if (cycleId) {
      const fueraDeCiclo = encontradas.some((oa) => oa.cycleId !== cycleId);
      if (fueraDeCiclo) {
        throw new AppBadRequestException(K.EVENTS.OPPORTUNITY_NOT_SELECTED, {
          id: cycleId,
        });
      }
    } else {
      const ciclos = new Set(encontradas.map((oa) => oa.cycleId));
      if (ciclos.size > 1) {
        throw new AppBadRequestException(K.EVENTS.OPPORTUNITY_NOT_SELECTED, {
          id: evento.id,
        });
      }
      [cycleId] = ciclos;
    }

    const ciclo = await this.cycles.findOne({ where: { id: cycleId } });
    if (!ciclo) {
      throw new AppBadRequestException(K.EVENTS.OPPORTUNITY_NOT_SELECTED, {
        id: cycleId,
      });
    }
    await this.unidadEnAlcance(user, ciclo.unitId);
  }

  async saveOpportunityPlan(
    user: AuthUser,
    id: string,
    opportunityId: string,
    dto: SaveOpportunityPlanDto,
  ): Promise<ProgramEventOpportunity> {
    const evento = await this.findOne(user, id);
    this.exigirAlcanceSobre(user, evento);
    const link = await this.links.findOne({
      where: { programEventId: id, learningOpportunityId: opportunityId },
    });
    if (!link) {
      throw new AppNotFoundException(K.EVENTS.NOT_FOUND, {
        id: opportunityId,
      });
    }
    return this.links.save({ ...link, plan: dto });
  }

  /**
   * Reglas 2 y 7: el ciclo existe, es de la MISMA unidad del evento, está
   * activo, vigente y contiene las fechas. Una actividad sin ciclo no pasa
   * por acá, y por eso no se consulta la tabla.
   *
   * El ciclo debe ser de `unitId`: sin este chequeo, cualquiera que pueda
   * crear reuniones en su unidad podría colgarlas de un ciclo ajeno —no hay
   * clave foránea compuesta en la base que lo impida—. Se rechaza con el
   * mismo `NO_ACTIVE_CYCLE` que "no existe": distinguir la respuesta dejaría
   * probar identificadores para averiguar si un ciclo ajeno existe.
   *
   * `isActive` es solo la baja lógica del ciclo y nunca se apaga sola al
   * vencer `endDate` (ver comentario en `Cycle`); por eso la vigencia se
   * verifica aparte con `hasEnded`. `today` recibe `new Date()` por defecto
   * y así el llamador real no tiene que pensar en la hora, pero las pruebas
   * pueden fijarlo sin congelar el reloj global.
   */
  private async validarContraCiclo(
    unitId: string,
    cycleId: string,
    startDate: Date,
    endDate: Date,
    today: Date = new Date(),
  ): Promise<void> {
    const ciclo = await this.cycles.findOne({ where: { id: cycleId } });
    if (
      !ciclo ||
      ciclo.unitId !== unitId ||
      !ciclo.isActive ||
      !ciclo.activatedAt ||
      hasEnded(ciclo.endDate, today)
    ) {
      throw new AppBadRequestException(K.EVENTS.NO_ACTIVE_CYCLE, { cycleId });
    }
    if (!isWithinCycle(startDate, endDate, ciclo.startDate, ciclo.endDate)) {
      throw new AppBadRequestException(K.EVENTS.OUTSIDE_CYCLE, { cycleId });
    }
  }

  private async unidadesAlcanzables(
    user: AuthUser,
    unitId?: string,
  ): Promise<string[]> {
    const unidades = await this.unitsService.findAll(user);
    const ids = unidades.map((unidad) => unidad.id);
    return unitId ? ids.filter((id) => id === unitId) : ids;
  }

  private async unidadEnAlcance(user: AuthUser, unitId: string): Promise<void> {
    const alcanzables = await this.unidadesAlcanzables(user, unitId);
    if (alcanzables.length === 0) {
      throw new AppForbiddenException(K.EVENTS.SCOPE_NOT_ALLOWED, { unitId });
    }
  }

  /**
   * H6, regla 11 en la otra puerta: `canUseScope` solo se llamaba en
   * create/update, y en update solo contra el scope ENTRANTE. Nadie
   * protegía el evento que YA EXISTE, así que un actor de rango bajo con
   * `event:update`/`event:delete` podía borrar, arrastrar o degradar un
   * evento de alcance superior al que él mismo puede crear. Se compara
   * contra `evento.scope` —el alcance ACTUAL, no el que llega en el DTO— en
   * cada puerta que toca un evento que ya existe.
   */
  private exigirAlcanceSobre(user: AuthUser, evento: ProgramEvent): void {
    if (!canUseScope(user.accessLevel, evento.scope)) {
      throw new AppForbiddenException(K.EVENTS.SCOPE_NOT_ALLOWED, {
        alcance: evento.scope,
      });
    }
  }
}
