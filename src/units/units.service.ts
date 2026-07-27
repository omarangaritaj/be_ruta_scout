import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
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
import { CurrentUserService } from '../current-user/current-user.service';
import { D, type Branch } from '../domain';
import { K } from '../i18n';
import { User, UserDocument } from '../users/schemas/user.schema';
import type { ConfigureUnitDto } from './dto/configure-unit.dto';
import type { UpdateUnitDto } from './dto/update-unit.dto';
import { projectMemberships } from './membership-projection';
import {
  UnitMembership,
  UnitMembershipDocument,
} from './schemas/unit-membership.schema';
import { Unit, UnitDocument } from './schemas/unit.schema';
import {
  placeholderName,
  planGroupSeed,
  type DiscardedPerson,
  type PlannedUnit,
  type SeedSkipReason,
} from './seeding/unit-seeder';
import { resolveUnitScope, scopeReaches } from './unit-scope';

const DUPLICATE_KEY = 11000;

/**
 * Techo de sufijos al bautizar una unidad clon. Sin él la búsqueda de nombre
 * libre es un bucle infinito con una consulta por vuelta dentro de la
 * transacción.
 */
const MAX_NAME_ATTEMPTS = 50;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY
  );
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
    @InjectModel(Unit.name)
    private readonly unitModel: Model<UnitDocument>,
    @InjectModel(UnitMembership.name)
    private readonly membershipModel: Model<UnitMembershipDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly currentUser: CurrentUserService,
  ) {}

  async findAll(user: AuthUser): Promise<UnitDocument[]> {
    const profile = await this.currentUser.get(user.idSiscout!);
    const scope = resolveUnitScope(profile);

    switch (scope.type) {
      case 'all':
        return this.unitModel.find().exec();

      case 'group':
        return this.ofGroup(scope.groupId);

      case 'branch': {
        const units = await this.ofGroup(scope.groupId);
        return units.filter((unit) => unit.branch === scope.branch);
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

  async findOne(user: AuthUser, id: string): Promise<UnitDocument> {
    return this.authorize(user, id);
  }

  /**
   * Puerta única de las operaciones por id: carga la unidad y comprueba que el
   * actor la alcance. Los cinco endpoints con `:id` entran por aquí, así que no
   * hay forma de añadir uno nuevo que se salte la comprobación sin notarlo.
   *
   * El 403 es deliberado: el recurso existe y devolver 404 mentiría sobre algo
   * que el actor ya conoce, porque `adults_of_the_group` le baja al dispositivo
   * los ids de todas las unidades de su grupo.
   */
  private async authorize(
    user: AuthUser,
    id: string,
    session: ClientSession | null = null,
  ): Promise<UnitDocument> {
    const unit = await this.unitModel.findById(id).session(session).exec();
    if (!unit) throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });

    const profile = await this.currentUser.get(user.idSiscout!);
    if (scopeReaches(resolveUnitScope(profile), unit)) return unit;

    // Un subjefe asignado a mano vive fuera de su alcance por cargo, pero su
    // fila en unit_memberships es justo lo que dice que esa unidad es suya.
    const member = await this.membershipModel
      .exists({ unitId: unit._id, userId: new Types.ObjectId(profile._id) })
      .session(session);
    if (member) return unit;

    throw new AppForbiddenException(K.UNITS.OUT_OF_SCOPE);
  }

  private async ofGroup(groupId: number): Promise<UnitDocument[]> {
    await this.seedGroup(groupId);
    return this.unitModel.find({ groupId }).exec();
  }

  /**
   * Siembra incremental. La condición de corte no es "el grupo ya tiene
   * unidades" sino "no queda ningún protagonista sin unidad": de lo contrario,
   * quien entrara por el sync después de la primera siembra se quedaba sin
   * unidad para siempre, porque ningún otro camino asigna una.
   */
  async seedGroup(groupId: number): Promise<SeedGroupOutcome> {
    const pending = await this.userModel.exists({
      groupId,
      estado: true,
      tipo: D.PERSON_TYPE.PROTAGONIST,
      unitId: null,
    });
    if (!pending) {
      return { status: 'skipped', reason: 'all-assigned', discarded: [] };
    }

    const people = await this.userModel
      .find({ groupId, estado: true })
      .select(
        '_id name tipo cargoSiscout cargos districtId districtName unitId',
      )
      .lean()
      .exec();

    const plan = planGroupSeed({
      groupId,
      people: people
        .filter((p) => p.tipo !== D.PERSON_TYPE.PROTAGONIST || !p.unitId)
        .map((p) => ({ ...p, _id: p._id.toString() })),
    });

    if (plan.units.length === 0) {
      return {
        status: 'skipped',
        reason: plan.skipped!,
        discarded: plan.discarded,
      };
    }

    try {
      const applied = await this.inTransaction(async (session) =>
        this.applySeedPlan(plan.units, groupId, session),
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
    session: ClientSession,
  ): Promise<{ created: PlannedUnit[]; joined: number }> {
    const created: PlannedUnit[] = [];
    let joined = 0;

    for (const unitPlan of planned) {
      const host = await this.branchHost(groupId, unitPlan.branch, session);

      if (!host) {
        const [unit] = await this.unitModel.create(
          [
            {
              ...unitPlan,
              unitLeaderId: new Types.ObjectId(unitPlan.unitLeaderId),
              members: unitPlan.members.map((id) => new Types.ObjectId(id)),
            },
          ],
          { session },
        );
        await this.syncMembership(unit, session);
        created.push(unitPlan);
        continue;
      }

      const present = new Set(host.members.map((id) => id.toString()));
      const incoming = unitPlan.members.filter((id) => !present.has(id));
      if (incoming.length === 0) continue;

      host.members = [
        ...host.members,
        ...incoming.map((id) => new Types.ObjectId(id)),
      ];
      await host.save({ session });
      await this.syncMembership(host, session);
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
   * dejaría otra vez sin poder borrarse. El `_id` ascendente desempata: es un
   * orden total y estable, a diferencia del nombre, que la jefatura cambia.
   */
  private async branchHost(
    groupId: number,
    branch: Branch,
    session: ClientSession,
  ): Promise<UnitDocument | null> {
    const candidates = await this.unitModel
      .find({ groupId, branch })
      .sort({ _id: 1 })
      .session(session)
      .exec();

    return (
      candidates.find((unit) => unit.members.length > 0) ??
      candidates[0] ??
      null
    );
  }

  private async inTransaction<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }

  /**
   * Único método autorizado a escribir las dos colecciones derivadas
   * (`unit_memberships` y `users.unitId`). Nadie más las toca, ni siquiera
   * `remove`: con `detached` la unidad se queda sin proyección y sin punteros,
   * que es lo que hace falta justo antes de borrarla.
   */
  private async syncMembership(
    unit: UnitDocument,
    session: ClientSession,
    { detached = false }: { detached?: boolean } = {},
  ): Promise<void> {
    const rows = detached
      ? []
      : projectMemberships({
          _id: unit._id.toString(),
          groupId: unit.groupId,
          unitLeaderId: unit.unitLeaderId.toString(),
          leaders: unit.leaders.map((id) => id.toString()),
          members: unit.members.map((id) => id.toString()),
        });

    await this.membershipModel.deleteMany({ unitId: unit._id }, { session });
    if (rows.length > 0) {
      await this.membershipModel.insertMany(
        rows.map((row) => ({
          userId: new Types.ObjectId(row.userId),
          unitId: new Types.ObjectId(row.unitId),
          role: row.role,
          groupId: row.groupId,
        })),
        { session },
      );
    }

    await this.userModel.updateMany(
      { unitId: unit._id },
      { $unset: { unitId: '' } },
      { session },
    );

    const members = detached ? [] : unit.members;
    if (members.length > 0) {
      await this.userModel.updateMany(
        { _id: { $in: members } },
        { $set: { unitId: unit._id } },
        { session },
      );
    }
  }

  /**
   * Jefe y subjefes tienen que ser adultos activos del grupo de la unidad.
   * `projectMemberships` les emite fila en `unit_memberships`, y esa fila es el
   * parámetro del bucket `units_of_the_member`: nombrar jefe a un protagonista
   * le bajaría al dispositivo los documentos completos de sus compañeros.
   */
  private async assertEligibleLeaders(
    unit: UnitDocument,
    candidates: Types.ObjectId[],
    session: ClientSession,
  ): Promise<void> {
    const unique = [
      ...new Map(candidates.map((id) => [id.toString(), id])).values(),
    ];
    if (unique.length === 0) return;

    const eligible = await this.userModel.countDocuments(
      {
        _id: { $in: unique },
        tipo: D.PERSON_TYPE.ADULT,
        estado: true,
        groupId: unit.groupId,
      },
      { session },
    );

    if (eligible !== unique.length) {
      throw new AppBadRequestException(K.UNITS.LEADER_NOT_ELIGIBLE);
    }
  }

  async configure(
    user: AuthUser,
    id: string,
    dto: ConfigureUnitDto,
  ): Promise<UnitDocument> {
    return this.inTransaction(async (session) => {
      const unit = await this.authorize(user, id, session);

      await this.assertEligibleLeaders(
        unit,
        [dto.unitLeaderId, ...dto.leaders],
        session,
      );

      unit.name = dto.name;
      unit.city = dto.city;
      unit.unitLeaderId = dto.unitLeaderId;
      unit.leaders = dto.leaders.filter(
        (leaderId) => !leaderId.equals(dto.unitLeaderId),
      );
      unit.configuredAt = new Date();

      try {
        await unit.save({ session });
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new AppBadRequestException(K.UNITS.NAME_TAKEN);
        }
        throw error;
      }

      await this.syncMembership(unit, session);
      return unit;
    });
  }

  async setMembers(
    user: AuthUser,
    id: string,
    memberIds: string[],
  ): Promise<UnitDocument[]> {
    return this.inTransaction(async (session) => {
      const unit = await this.authorize(user, id, session);

      const current = unit.members.map((m) => m.toString());
      const staying = new Set(memberIds);

      if (memberIds.some((memberId) => !current.includes(memberId))) {
        throw new AppBadRequestException(K.UNITS.MEMBERS_NOT_IN_UNIT);
      }

      const leaving = current.filter((memberId) => !staying.has(memberId));

      unit.members = memberIds.map((memberId) => new Types.ObjectId(memberId));
      await unit.save({ session });
      await this.syncMembership(unit, session);

      if (leaving.length === 0) return [unit];

      const [clone] = await this.unitModel.create(
        [
          {
            name: await this.freeName(unit.groupId, unit.branch, session),
            branch: unit.branch,
            groupId: unit.groupId,
            districtId: unit.districtId,
            districtName: unit.districtName,
            city: unit.city,
            unitLeaderId: unit.unitLeaderId,
            leaders: [],
            members: leaving.map((memberId) => new Types.ObjectId(memberId)),
          },
        ],
        { session },
      );
      await this.syncMembership(clone, session);

      return [unit, clone];
    });
  }

  private async freeName(
    groupId: number,
    branch: Branch,
    session: ClientSession,
  ): Promise<string> {
    const last = MAX_NAME_ATTEMPTS + 1;
    for (let index = 2; index <= last; index += 1) {
      const candidate = placeholderName(branch, index);
      const taken = await this.unitModel
        .exists({ groupId, name: candidate })
        .session(session);
      if (!taken) return candidate;
    }

    throw new AppConflictException(K.UNITS.NAME_EXHAUSTED, { branch });
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateUnitDto,
  ): Promise<UnitDocument> {
    return this.inTransaction(async (session) => {
      const current = await this.authorize(user, id, session);

      const patch = { ...dto };
      if (patch.unitLeaderId && patch.leaders) {
        const unitLeaderId = patch.unitLeaderId;
        patch.leaders = patch.leaders.filter(
          (leaderId) => !leaderId.equals(unitLeaderId),
        );
      }

      await this.assertEligibleLeaders(
        current,
        [
          ...(patch.unitLeaderId ? [patch.unitLeaderId] : []),
          ...(patch.leaders ?? []),
        ],
        session,
      );

      let unit: UnitDocument | null;
      try {
        unit = await this.unitModel
          .findByIdAndUpdate(id, patch, {
            returnDocument: 'after',
            runValidators: true,
            session,
          })
          .exec();
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new AppBadRequestException(K.UNITS.NAME_TAKEN);
        }
        throw error;
      }
      if (!unit) throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });

      await this.syncMembership(unit, session);
      return unit;
    });
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    await this.inTransaction(async (session) => {
      const unit = await this.authorize(user, id, session);
      if (unit.members.length > 0) {
        throw new AppBadRequestException(K.UNITS.CANNOT_DELETE_WITH_MEMBERS);
      }

      await this.syncMembership(unit, session, { detached: true });
      await this.unitModel.findByIdAndDelete(id, { session }).exec();
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
  ): Promise<UnitDocument[]> {
    const branch = ramaDeCargo(nombreCargo);
    if (!branch) {
      throw new AppBadRequestException(K.UNITS.LEADERSHIP_NOT_A_BRANCH, {
        cargo: nombreCargo,
      });
    }

    const profile = await this.currentUser.get(user.idSiscout!);
    const scope = resolveUnitScope(profile);
    if (scope.type === 'no-group') {
      throw new AppBadRequestException(K.UNITS.MISSING_GROUP);
    }
    if (scope.type !== 'leadership-required') {
      throw new AppForbiddenException(K.UNITS.LEADERSHIP_ALREADY_SCOPED);
    }

    // El filtro es "ningún cargo de rama", no "este cargo sin repetir": el
    // perfil que leyó la guarda viene de la caché, así que dos peticiones a la
    // vez la pasarían las dos. Que la escritura no prenda significa que otra
    // llegó primero, y entonces la rama concedida no es la que se pidió.
    const { modifiedCount } = await this.userModel
      .updateOne(
        { _id: profile._id, 'cargos.nivel': { $ne: D.ROLE_LEVEL.RAMA } },
        { $push: { cargos: { nombreCargo, nivel: D.ROLE_LEVEL.RAMA } } },
      )
      .exec();
    if (modifiedCount === 0) {
      throw new AppForbiddenException(K.UNITS.LEADERSHIP_ALREADY_SCOPED);
    }

    await this.currentUser.refresh(user.idSiscout!);

    const units = await this.ofGroup(scope.groupId);
    return units.filter((unit) => unit.branch === branch);
  }
}
