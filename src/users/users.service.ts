import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type DeepPartial } from 'typeorm';
import { EscalationService } from '../authz/escalation.service';
import {
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { D } from '../domain';
import {
  EMAIL_NOTIFIER,
  type EmailNotifier,
} from '../email/email-notifier.port';
import { K } from '../i18n';
import { Notificador } from '../notificaciones/notificador.port';
import { SiscoutSnapshotService } from '../siscout/siscout-snapshot.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersDto, PaginatedUsers } from './dto/list-users.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/role.entity';
import { User, type EstadoAcceso } from './user.entity';

/** Código que devuelve Postgres al violar un índice único. */
const UNIQUE_VIOLATION = '23505';

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'driverError' in error &&
    (error as { driverError?: { code?: string } }).driverError?.code ===
      UNIQUE_VIOLATION
  );
}

/** Escapa un término libre para usarlo dentro de un `ILIKE` sin sorpresas. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

/** Referencias a roles por id, suficientes para escribir la tabla puente. */
function roleRefs(ids: readonly string[]): Role[] {
  return ids.map((id) => ({ id }) as Role);
}

/**
 * ¿El cambio toca la gestión de acceso (no solo datos de perfil)? Determina si
 * aplica la regla anti-auto-modificación: un admin no se edita su propio acceso.
 * Los roles cuentan: son de dónde salen sus permisos y sus páginas. Los cargos
 * también: un cargo de nivel `rama` concede alcance sobre esa rama.
 */
function touchesAccess(dto: UpdateUserDto): boolean {
  return (
    dto.estadoAcceso !== undefined ||
    dto.nivelAcceso !== undefined ||
    dto.roles !== undefined ||
    dto.cargos !== undefined ||
    dto.districtId !== undefined ||
    dto.groupId !== undefined
  );
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly escalation: EscalationService,
    private readonly notificador: Notificador,
    private readonly snapshots: SiscoutSnapshotService,
    @Inject(EMAIL_NOTIFIER)
    private readonly email: EmailNotifier,
  ) {}

  private readonly logger = new Logger(UsersService.name);

  async create(actorId: string, dto: CreateUserDto): Promise<User> {
    const roles = 'roles' in dto ? dto.roles : [];
    await this.escalation.assertCanGrantRoles(actorId, [], roles);

    try {
      // La unión discriminada del DTO confunde el overload objeto/arreglo de
      // `create`; el tipo de destino explícito lo desambigua.
      const fields: DeepPartial<User> = { ...dto, roles: roleRefs(roles) };
      const user = this.users.create(fields);
      return await this.users.save(user);
    } catch (error) {
      // `idSiscout` es único: sin esto el driver devolvería un 500 opaco.
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.USERS.SISCOUT_ID_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Lista paginada para el panel de gestión. Solo usuarios GESTIONABLES (con
   * acceso: aprobado o suspendido) y nunca el super_admin. Los filtros de nivel,
   * región y nombre son opcionales; la búsqueda por nombre es case-insensitive.
   */
  async findAll(filtros: ListUsersDto): Promise<PaginatedUsers<User>> {
    const { estado, nivel, region, q, page, pageSize } = filtros;

    const query = this.users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role');

    if (estado) {
      query.andWhere('user.estadoAcceso = :estado', { estado });
    } else {
      query.andWhere('user.estadoAcceso IN (:...estados)', {
        estados: [D.ACCESS_STATE.APPROVED, D.ACCESS_STATE.SUSPENDED],
      });
    }

    if (nivel) {
      query.andWhere('user.nivelAcceso = :nivel', { nivel });
    } else {
      // Un nivel concreto acota; sin él, se excluye al super_admin de la lista.
      query.andWhere(
        '(user.nivelAcceso IS NULL OR user.nivelAcceso != :superAdmin)',
        { superAdmin: D.ACCESS_LEVEL.SUPER_ADMIN },
      );
    }

    if (region !== undefined) {
      query.andWhere('user.districtId = :region', { region });
    }
    if (q) {
      query.andWhere('user.name ILIKE :q', { q: `%${escapeLike(q)}%` });
    }

    const [items, total] = await query
      .orderBy('user.name', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  /**
   * Regiones distintas presentes entre los usuarios gestionables. Alimenta el
   * `<select>` de región del panel: sin esto el filtro exigiría adivinar IDs.
   */
  async distinctRegions(): Promise<
    { districtId: number; districtName: string }[]
  > {
    const rows = await this.users
      .createQueryBuilder('user')
      .select('user.districtId', 'districtId')
      .addSelect('MIN(user.districtName)', 'districtName')
      .where('user.districtId IS NOT NULL')
      .andWhere('user.estadoAcceso IN (:...estados)', {
        estados: [D.ACCESS_STATE.APPROVED, D.ACCESS_STATE.SUSPENDED],
      })
      .groupBy('user.districtId')
      .orderBy('MIN(user.districtName)', 'ASC')
      .getRawMany<{ districtId: number; districtName: string }>();

    return rows;
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id },
      relations: { roles: true },
    });

    if (!user) {
      throw new AppNotFoundException(K.USERS.NOT_FOUND, { id });
    }

    return user;
  }

  /**
   * Edita un usuario. Aquí vive la gestión de acceso (nivel, estado, territorio,
   * roles, cargos), protegida por cuatro invariantes:
   *   1. Nadie modifica su propio acceso (evita que un admin se auto-escale).
   *   2. Al super_admin no se le gestiona desde el panel.
   *   3. Nadie concede un rol que le dé a otro lo que él mismo no tiene.
   *   4. Nadie concede un nivel de acceso al que él mismo no llega.
   */
  async update(actorId: string, id: string, dto: UpdateUserDto): Promise<User> {
    if (actorId === id && touchesAccess(dto)) {
      throw new AppForbiddenException(K.USERS.CANNOT_MODIFY_OWN_ACCESS);
    }

    const target = await this.users.findOne({
      where: { id },
      relations: { roles: true },
    });
    if (!target) {
      throw new AppNotFoundException(K.USERS.NOT_FOUND, { id });
    }
    if (target.nivelAcceso === D.ACCESS_LEVEL.SUPER_ADMIN) {
      throw new AppForbiddenException(K.USERS.CANNOT_MANAGE_SUPER_ADMIN);
    }
    // Dejarle el nivel que ya tenía no concede nada, así que no se valida: es
    // la misma asimetría de los roles, y el panel reenvía el nivel en cada
    // guardado aunque el cambio sea de región o de cargo.
    if (
      dto.nivelAcceso !== undefined &&
      dto.nivelAcceso !== target.nivelAcceso
    ) {
      await this.escalation.assertCanGrantLevel(actorId, dto.nivelAcceso);
    }

    if (dto.roles !== undefined) {
      await this.escalation.assertCanGrantRoles(
        actorId,
        target.roles.map((role) => role.id),
        dto.roles,
      );
    }

    // Se guarda ANTES de avisar, pero el estado previo se lee ANTES de guardar:
    // después de `Object.assign` ya no habría con qué comparar.
    const estadoPrevio = target.estadoAcceso;

    try {
      const { roles, ...fields } = dto;
      Object.assign(target, fields);
      if (roles !== undefined) target.roles = roleRefs(roles);
      const saved = await this.users.save(target);
      await this.avisarCambioDeAcceso(saved, estadoPrevio);
      return this.findOne(saved.id);
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.USERS.SISCOUT_ID_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Avisa cuando el acceso se suspende o se restablece.
   *
   * Era la etapa que faltaba del flujo: a alguien lo suspendían, entraba a la
   * app, chocaba con la pantalla de acceso suspendido y nunca supo por qué ni
   * cuándo. Enterarse por un muro es la peor manera.
   *
   * El fallo del correo NO tumba la operación: la suspensión ya está escrita y
   * es lo que protege el acceso; quedarse sin avisar es malo, pero revertir una
   * suspensión porque el proveedor de correo está caído sería peor.
   */
  private async avisarCambioDeAcceso(
    persona: User,
    estadoPrevio: EstadoAcceso,
  ): Promise<void> {
    const suspendido = persona.estadoAcceso === D.ACCESS_STATE.SUSPENDED;
    const reactivado =
      estadoPrevio === D.ACCESS_STATE.SUSPENDED &&
      persona.estadoAcceso === D.ACCESS_STATE.APPROVED;

    if (persona.estadoAcceso === estadoPrevio) return;
    if (!suspendido && !reactivado) return;

    await this.notificador.encolar({
      tipo: 'acceso_cambiado',
      destinatario: { personaId: persona.id },
      datos: { suspendido },
    });

    try {
      // El correo vive en el snapshot cifrado, no en la tabla pública.
      const snapshot = await this.snapshots.findDecrypted(persona.idSiscout);
      const to = typeof snapshot?.email === 'string' ? snapshot.email : null;
      if (!to) return;

      await this.email.sendAccesoCambiado({
        to,
        nombre: persona.name,
        suspendido,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el correo de cambio de acceso: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const target = await this.users.findOne({ where: { id } });

    if (!target) {
      throw new AppNotFoundException(K.USERS.NOT_FOUND, { id });
    }

    await this.users.remove(target);
  }
}
