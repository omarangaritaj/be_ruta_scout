import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  cargosDeJefaturaDeRama,
  ramaDeCargo,
} from '../catalogo-cargos/catalogo-cargos';
import {
  AppBadRequestException,
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { D, type Branch } from '../domain';
import { K } from '../i18n';
import { User } from '../users/user.entity';
import type { ConfigureUnitDto } from './dto/configure-unit.dto';
import type { UpdateUnitDto } from './dto/update-unit.dto';
import { projectMemberships } from './membership-projection';
import {
  placeholderName,
  planGroupSeed,
  type DiscardedPerson,
  type PlannedUnit,
  type SeedSkipReason,
} from './seeding/unit-seeder';
import { UnitMembership } from './unit-membership.entity';
import { Unit } from './unit.entity';
import { resolveUnitScope, scopeReaches } from './unit-scope';

/** Código que devuelve Postgres al violar un índice único. */
const UNIQUE_VIOLATION = '23505';

/**
 * Techo de sufijos al bautizar una unidad clon. Sin él la búsqueda de nombre
 * libre es un bucle infinito con una consulta por vuelta dentro de la
 * transacción.
 */
const MAX_NAME_ATTEMPTS = 50;

/** Relaciones que hacen falta para proyectar y serializar una unidad. */
const UNIT_RELATIONS = { leaders: true, members: true } as const;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'driverError' in error &&
    (error as { driverError?: { code?: string } }).driverError?.code ===
      UNIQUE_VIOLATION
  );
}

/** Referencias a usuarios por id, suficientes para escribir las tablas puente. */
function userRefs(ids: readonly string[]): User[] {
  return ids.map((id) => ({ id }) as User);
}

/**
 * Forma con la que una unidad viaja por HTTP: los mismos nombres del contrato
 * del sistema anterior (`unitLeaderId`, `leaders` y `members` como arreglos de
 * ids) y nunca las entidades User completas de las relaciones.
 */
export interface UnitView {
  id: string;
  name: string;
  branch: Branch;
  groupId: number;
  districtId?: number;
  districtName?: string;
  city?: string;
  unitLeaderId: string;
  leaders: string[];
  members: string[];
  configuredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnitPerson {
  id: string;
  name: string;
  tipo: string;
  groupId?: number;
  unitId?: string;
}

export interface UnitPeople {
  members: UnitPerson[];
  adults: UnitPerson[];
}

export type SeedGroupOutcome =
  | {
      status: 'seeded';
      created: PlannedUnit[];
      joined: number;
      discarded: DiscardedPerson[];
    }
  | {
      status: 'skipped';
      reason: SeedSkipReason | 'all-assigned' | 'already-seeded';
      discarded: DiscardedPerson[];
    };

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly units: Repository<Unit>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(user: AuthUser): Promise<UnitView[]> {
    const profile = await this.profileOf(user);
    const scope = resolveUnitScope(profile);

    switch (scope.type) {
      case 'all': {
        const units = await this.units.find({ relations: UNIT_RELATIONS });
        return units.map((unit) => this.toView(unit));
      }

      case 'group': {
        const units = await this.ofGroup(scope.groupId);
        return units.map((unit) => this.toView(unit));
      }

      case 'branch': {
        const units = await this.ofGroup(scope.groupId);
        return units
          .filter((unit) => unit.branch === scope.branch)
          .map((unit) => this.toView(unit));
      }

      case 'no-group':
        throw new AppBadRequestException(K.UNITS.MISSING_GROUP);

      case 'leadership-required':
        throw new AppBadRequestException(
          K.UNITS.LEADERSHIP_REQUIRED,
          undefined,
          { jefaturas: cargosDeJefaturaDeRama() },
        );
    }
  }

  async findOne(user: AuthUser, id: string): Promise<UnitView> {
    return this.toView(await this.authorize(user, id));
  }

  /**
   * Las dos listas que pinta el detalle. Se sirven por HTTP: la unidad se
   * administra en línea, así que replicar personas al dispositivo solo añadía
   * una copia que mantener y un dato de menores que custodiar.
   *
   * La proyección es explícita, no `*`: de `users` solo sale lo que la pantalla
   * muestra, y nunca la fila completa de un protagonista menor de edad.
   */
  async people(user: AuthUser, id: string): Promise<UnitPeople> {
    const unit = await this.authorize(user, id);

    const [members, adults] = await Promise.all([
      this.peopleBy({ unitId: unit.id, tipo: D.PERSON_TYPE.PROTAGONIST }),
      this.peopleBy({
        groupId: unit.groupId,
        tipo: D.PERSON_TYPE.ADULT,
        estado: true,
      }),
    ]);

    return { members, adults };
  }

  private async peopleBy(
    filter: FindOptionsWhere<User>,
  ): Promise<UnitPerson[]> {
    const people = await this.users.find({
      where: filter,
      select: { id: true, name: true, tipo: true, groupId: true, unitId: true },
      order: { name: 'ASC' },
    });

    return people.map((person) => ({
      id: person.id,
      name: person.name,
      tipo: person.tipo,
      groupId: person.groupId ?? undefined,
      unitId: person.unitId ?? undefined,
    }));
  }

  /**
   * Perfil de la persona autenticada, leído de la base en cada operación
   * (sustituye a la caché de current-user del sistema anterior).
   */
  private async profileOf(
    user: AuthUser,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<User> {
    const profile = await manager.findOne(User, {
      where: { id: user.userId },
    });
    if (!profile) {
      throw new AppNotFoundException(K.REQUESTS.AUTHENTICATED_PERSON_NOT_FOUND);
    }
    return profile;
  }

  /**
   * Puerta única de las operaciones por id: carga la unidad y comprueba que el
   * actor la alcance. Los cinco endpoints con `:id` entran por aquí, así que no
   * hay forma de añadir uno nuevo que se salte la comprobación sin notarlo.
   *
   * El 403 es deliberado: el recurso existe y devolver 404 mentiría sobre algo
   * que el actor ya conoce, porque `GET /units` le lista las unidades de su
   * grupo con sus ids.
   */
  private async authorize(
    user: AuthUser,
    id: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Unit> {
    const unit = await manager.findOne(Unit, {
      where: { id },
      relations: UNIT_RELATIONS,
    });
    if (!unit) throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });

    const profile = await this.profileOf(user, manager);
    if (scopeReaches(resolveUnitScope(profile), unit)) return unit;

    // Un subjefe asignado a mano vive fuera de su alcance por cargo, pero su
    // fila en unit_memberships es justo lo que dice que esa unidad es suya.
    const member = await manager.exists(UnitMembership, {
      where: { unitId: unit.id, userId: profile.id },
    });
    if (member) return unit;

    throw new AppForbiddenException(K.UNITS.OUT_OF_SCOPE);
  }

  private async ofGroup(groupId: number): Promise<Unit[]> {
    await this.seedGroup(groupId);
    return this.units.find({ where: { groupId }, relations: UNIT_RELATIONS });
  }

  /**
   * Siembra incremental. La condición de corte no es "el grupo ya tiene
   * unidades" sino "no queda ningún protagonista sin unidad": de lo contrario,
   * quien entrara por el sync después de la primera siembra se quedaba sin
   * unidad para siempre, porque ningún otro camino asigna una.
   */
  async seedGroup(groupId: number): Promise<SeedGroupOutcome> {
    const pending = await this.users.exists({
      where: {
        groupId,
        estado: true,
        tipo: D.PERSON_TYPE.PROTAGONIST,
        unitId: IsNull(),
      },
    });
    if (!pending) {
      return { status: 'skipped', reason: 'all-assigned', discarded: [] };
    }

    const people = await this.users.find({
      where: { groupId, estado: true },
      select: {
        id: true,
        name: true,
        tipo: true,
        cargoSiscout: true,
        cargos: true,
        age: true,
        districtId: true,
        districtName: true,
        unitId: true,
      },
    });

    const plan = planGroupSeed({
      groupId,
      people: people
        .filter((p) => p.tipo !== D.PERSON_TYPE.PROTAGONIST || !p.unitId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          tipo: p.tipo,
          cargoSiscout: p.cargoSiscout ?? undefined,
          cargos: p.cargos,
          age: p.age ?? undefined,
          districtId: p.districtId ?? undefined,
          districtName: p.districtName ?? undefined,
        })),
    });

    if (plan.units.length === 0) {
      return {
        status: 'skipped',
        reason: plan.skipped!,
        discarded: plan.discarded,
      };
    }

    try {
      const applied = await this.inTransaction(async (manager) =>
        this.applySeedPlan(plan.units, groupId, manager),
      );

      return { status: 'seeded', ...applied, discarded: plan.discarded };
    } catch (error) {
      // El índice único {groupId, name} es lo que impide duplicar la unidad
      // cuando dos dirigentes de la misma rama entran a la vez. El que pierde
      // la carrera no ha dejado nada a medias: la transacción revierte y el
      // ganador ya sembró lo mismo.
      if (isDuplicateKey(error)) {
        return {
          status: 'skipped',
          reason: 'already-seeded',
          discarded: plan.discarded,
        };
      }
      throw error;
    }
  }

  private async applySeedPlan(
    planned: PlannedUnit[],
    groupId: number,
    manager: EntityManager,
  ): Promise<{ created: PlannedUnit[]; joined: number }> {
    const created: PlannedUnit[] = [];
    let joined = 0;

    for (const unitPlan of planned) {
      const host = await this.branchHost(groupId, unitPlan.branch, manager);

      if (!host) {
        const unit = manager.create(Unit, {
          name: unitPlan.name,
          branch: unitPlan.branch,
          groupId: unitPlan.groupId,
          districtId: unitPlan.districtId,
          districtName: unitPlan.districtName,
          leaderId: unitPlan.leaderId,
          leaders: userRefs(unitPlan.leaders),
          members: userRefs(unitPlan.members),
        });
        await manager.save(unit);
        await this.syncMembership(unit, manager);
        created.push(unitPlan);
        continue;
      }

      const present = new Set(host.members.map((member) => member.id));
      const incoming = unitPlan.members.filter((id) => !present.has(id));
      if (incoming.length === 0) continue;

      host.members = [...host.members, ...userRefs(incoming)];
      await manager.save(host);
      await this.syncMembership(host, manager);
      joined += incoming.length;
    }

    return { created, joined };
  }

  /**
   * Unidad de la rama que recibe a los protagonistas nuevos cuando ya existe
   * alguna. Criterio: la más antigua con miembros, y si todas están vacías, la
   * más antigua a secas.
   *
   * Se prefiere una con miembros porque una unidad vacía suele estar en
   * tránsito hacia el borrado (es la única vía para eliminarla) y repoblarla la
   * dejaría otra vez sin poder borrarse. `createdAt` con `id` de desempate da
   * un orden total y estable, a diferencia del nombre, que la jefatura cambia.
   */
  private async branchHost(
    groupId: number,
    branch: Branch,
    manager: EntityManager,
  ): Promise<Unit | null> {
    const candidates = await manager.find(Unit, {
      where: { groupId, branch },
      relations: UNIT_RELATIONS,
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    return (
      candidates.find((unit) => unit.members.length > 0) ??
      candidates[0] ??
      null
    );
  }

  private inTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  /**
   * Único método autorizado a escribir las dos tablas derivadas
   * (`unit_memberships` y `users.unitId`). Nadie más las toca, ni siquiera
   * `remove`: con `detached` la unidad se queda sin proyección y sin punteros,
   * que es lo que hace falta justo antes de borrarla.
   */
  private async syncMembership(
    unit: Unit,
    manager: EntityManager,
    { detached = false }: { detached?: boolean } = {},
  ): Promise<void> {
    const rows = detached
      ? []
      : projectMemberships({
          id: unit.id,
          groupId: unit.groupId,
          leaderId: unit.leaderId,
          leaders: unit.leaders.map((leader) => leader.id),
          members: unit.members.map((member) => member.id),
        });

    await manager.delete(UnitMembership, { unitId: unit.id });
    if (rows.length > 0) {
      await manager.insert(
        UnitMembership,
        rows.map((row) => ({
          userId: row.userId,
          unitId: row.unitId,
          role: row.role,
          groupId: row.groupId,
        })),
      );
    }

    await manager.update(User, { unitId: unit.id }, { unitId: null });

    const memberIds = detached ? [] : unit.members.map((member) => member.id);
    if (memberIds.length > 0) {
      await manager.update(User, { id: In(memberIds) }, { unitId: unit.id });
    }
  }

  /**
   * Jefe y subjefes tienen que ser adultos activos del grupo de la unidad.
   * `projectMemberships` les emite fila en `unit_memberships`, y esa fila es la
   * que define el alcance sobre la unidad: nombrar jefe a un protagonista le
   * daría acceso a los documentos completos de sus compañeros.
   */
  private async assertEligibleLeaders(
    unit: Unit,
    candidates: string[],
    manager: EntityManager,
  ): Promise<void> {
    const unique = [...new Set(candidates)];
    if (unique.length === 0) return;

    const eligible = await manager.count(User, {
      where: {
        id: In(unique),
        tipo: D.PERSON_TYPE.ADULT,
        estado: true,
        groupId: unit.groupId,
      },
    });

    if (eligible !== unique.length) {
      throw new AppBadRequestException(K.UNITS.LEADER_NOT_ELIGIBLE);
    }
  }

  async configure(
    user: AuthUser,
    id: string,
    dto: ConfigureUnitDto,
  ): Promise<UnitView> {
    return this.inTransaction(async (manager) => {
      const unit = await this.authorize(user, id, manager);

      await this.assertEligibleLeaders(
        unit,
        [dto.unitLeaderId, ...dto.leaders],
        manager,
      );

      unit.name = dto.name;
      unit.city = dto.city;
      unit.leaderId = dto.unitLeaderId;
      unit.leaders = userRefs(
        dto.leaders.filter((leaderId) => leaderId !== dto.unitLeaderId),
      );
      unit.configuredAt = new Date();

      try {
        await manager.save(unit);
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new AppBadRequestException(K.UNITS.NAME_TAKEN);
        }
        throw error;
      }

      await this.syncMembership(unit, manager);
      return this.toView(unit);
    });
  }

  async setMembers(
    user: AuthUser,
    id: string,
    memberIds: string[],
    targetUnitId?: string,
  ): Promise<UnitView[]> {
    return this.inTransaction(async (manager) => {
      const unit = await this.authorize(user, id, manager);

      const current = unit.members.map((member) => member.id);
      const staying = new Set(memberIds);

      if (memberIds.some((memberId) => !current.includes(memberId))) {
        throw new AppBadRequestException(K.UNITS.MEMBERS_NOT_IN_UNIT);
      }

      const leaving = current.filter((memberId) => !staying.has(memberId));

      unit.members = userRefs(memberIds);
      await manager.save(unit);
      await this.syncMembership(unit, manager);

      if (leaving.length === 0) return [this.toView(unit)];

      if (targetUnitId) {
        const target = await this.receivingUnit(
          user,
          unit,
          targetUnitId,
          manager,
        );
        target.members = [...target.members, ...userRefs(leaving)];
        await manager.save(target);
        await this.syncMembership(target, manager);
        return [this.toView(unit), this.toView(target)];
      }

      const clone = manager.create(Unit, {
        name: await this.freeName(unit.groupId, unit.branch, manager),
        branch: unit.branch,
        groupId: unit.groupId,
        districtId: unit.districtId,
        districtName: unit.districtName,
        city: unit.city,
        leaderId: unit.leaderId,
        leaders: [],
        members: userRefs(leaving),
      });
      await manager.save(clone);
      await this.syncMembership(clone, manager);

      return [this.toView(unit), this.toView(clone)];
    });
  }

  /**
   * Unidad que recibe a los salientes. Pasa por `authorize` como cualquier otra
   * operación por id, así que nadie puede empujar protagonistas hacia una unidad
   * fuera de su alcance. La rama y el grupo tienen que coincidir: la rama de un
   * protagonista la determina su cargo de SiScout o su edad, no el traslado.
   */
  private async receivingUnit(
    user: AuthUser,
    origin: Unit,
    targetUnitId: string,
    manager: EntityManager,
  ): Promise<Unit> {
    if (targetUnitId === origin.id) {
      throw new AppBadRequestException(K.UNITS.TARGET_NOT_COMPATIBLE);
    }

    const target = await this.authorize(user, targetUnitId, manager);
    if (target.groupId !== origin.groupId || target.branch !== origin.branch) {
      throw new AppBadRequestException(K.UNITS.TARGET_NOT_COMPATIBLE);
    }

    return target;
  }

  private async freeName(
    groupId: number,
    branch: Branch,
    manager: EntityManager,
  ): Promise<string> {
    const last = MAX_NAME_ATTEMPTS + 1;
    for (let index = 2; index <= last; index += 1) {
      const candidate = placeholderName(branch, index);
      const taken = await manager.exists(Unit, {
        where: { groupId, name: candidate },
      });
      if (!taken) return candidate;
    }

    throw new AppConflictException(K.UNITS.NAME_EXHAUSTED, { branch });
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateUnitDto,
  ): Promise<UnitView> {
    return this.inTransaction(async (manager) => {
      const unit = await this.authorize(user, id, manager);

      const patch = { ...dto };
      if (patch.unitLeaderId && patch.leaders) {
        const unitLeaderId = patch.unitLeaderId;
        patch.leaders = patch.leaders.filter(
          (leaderId) => leaderId !== unitLeaderId,
        );
      }

      await this.assertEligibleLeaders(
        unit,
        [
          ...(patch.unitLeaderId ? [patch.unitLeaderId] : []),
          ...(patch.leaders ?? []),
        ],
        manager,
      );

      if (patch.name !== undefined) unit.name = patch.name;
      if (patch.districtId !== undefined) unit.districtId = patch.districtId;
      if (patch.districtName !== undefined) {
        unit.districtName = patch.districtName;
      }
      if (patch.city !== undefined) unit.city = patch.city;
      if (patch.unitLeaderId !== undefined) unit.leaderId = patch.unitLeaderId;
      if (patch.leaders !== undefined) unit.leaders = userRefs(patch.leaders);

      try {
        await manager.save(unit);
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new AppBadRequestException(K.UNITS.NAME_TAKEN);
        }
        throw error;
      }

      await this.syncMembership(unit, manager);
      return this.toView(unit);
    });
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.inTransaction(async (manager) => {
      const unit = await this.authorize(user, id, manager);
      if (unit.members.length > 0) {
        throw new AppBadRequestException(K.UNITS.CANNOT_DELETE_WITH_MEMBERS);
      }

      await this.syncMembership(unit, manager, { detached: true });
      await manager.delete(Unit, { id: unit.id });
    });
  }

  /**
   * Esto escribe el atributo sobre el que se apoya el alcance, así que la única
   * condición admisible es la que justifica el endpoint: no tener rama todavía,
   * ni por SiScout ni por una declaración previa. Eso ya es `leadership-required`,
   * y por eso la guarda pregunta por el alcance en vez de comparar cargos:
   * contrastar el declarado contra `cargoSiscout` cerraría el endpoint a quien lo
   * necesita, que es justo quien no tiene rama ahí (un colaborador de grupo).
   */
  async declareLeadership(
    user: AuthUser,
    nombreCargo: string,
  ): Promise<UnitView[]> {
    const branch = ramaDeCargo(nombreCargo);
    if (!branch) {
      throw new AppBadRequestException(K.UNITS.LEADERSHIP_NOT_A_BRANCH, {
        cargo: nombreCargo,
      });
    }

    const profile = await this.profileOf(user);
    const scope = resolveUnitScope(profile);
    if (scope.type === 'no-group') {
      throw new AppBadRequestException(K.UNITS.MISSING_GROUP);
    }
    if (scope.type !== 'leadership-required') {
      throw new AppForbiddenException(K.UNITS.LEADERSHIP_ALREADY_SCOPED);
    }

    // El filtro es "ningún cargo de rama", no "este cargo sin repetir": el
    // perfil que leyó la guarda se leyó antes de escribir, así que dos
    // peticiones a la vez la pasarían las dos. Que la escritura no prenda
    // significa que otra llegó primero, y entonces la rama concedida no es la
    // que se pidió.
    const result = await this.dataSource
      .createQueryBuilder()
      .update(User)
      .set({ cargos: () => `"cargos" || :cargoNuevo::jsonb` })
      .where('id = :id', { id: profile.id })
      .andWhere(`NOT ("cargos" @> :cargoDeRama::jsonb)`, {
        cargoDeRama: JSON.stringify([{ nivel: D.ROLE_LEVEL.RAMA }]),
      })
      .setParameter(
        'cargoNuevo',
        JSON.stringify([{ nombreCargo, nivel: D.ROLE_LEVEL.RAMA }]),
      )
      .execute();
    if ((result.affected ?? 0) === 0) {
      throw new AppForbiddenException(K.UNITS.LEADERSHIP_ALREADY_SCOPED);
    }

    const units = await this.ofGroup(scope.groupId);
    return units
      .filter((unit) => unit.branch === branch)
      .map((unit) => this.toView(unit));
  }

  private toView(unit: Unit): UnitView {
    return {
      id: unit.id,
      name: unit.name,
      branch: unit.branch,
      groupId: unit.groupId,
      districtId: unit.districtId ?? undefined,
      districtName: unit.districtName ?? undefined,
      city: unit.city ?? undefined,
      unitLeaderId: unit.leaderId,
      leaders: unit.leaders.map((leader) => leader.id),
      members: unit.members.map((member) => member.id),
      configuredAt: unit.configuredAt ?? undefined,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }
}
