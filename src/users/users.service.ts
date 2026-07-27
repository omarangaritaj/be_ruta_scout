import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type QueryFilter } from 'mongoose';
import {
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
} from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { K } from '../i18n';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersDto, PaginatedUsers } from './dto/list-users.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

/** Código que devuelve MongoDB al violar un índice único. */
const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY
  );
}

/** Escapa un término libre para usarlo dentro de un `$regex` sin inyección. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ¿El cambio toca la gestión de acceso (no solo datos de perfil)? Determina si
 * aplica la regla anti-auto-modificación: un admin no se edita su propio acceso.
 */
function touchesAccess(dto: UpdateUserDto): boolean {
  return (
    dto.estadoAcceso !== undefined ||
    dto.nivelAcceso !== undefined ||
    dto.districtId !== undefined ||
    dto.groupId !== undefined
  );
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly currentUser: CurrentUserService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    try {
      return await this.userModel.create(dto);
    } catch (error) {
      // `idSiscout` es único: sin esto Mongoose devolvería un 500 opaco.
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
  async findAll(filtros: ListUsersDto): Promise<PaginatedUsers<UserDocument>> {
    const { estado, nivel, region, q, page, pageSize } = filtros;

    const query: QueryFilter<UserDocument> = {
      estadoAcceso: estado ?? { $in: ['aprobado', 'suspendido'] },
      // Un nivel concreto acota; sin él, se excluye al super_admin de la lista.
      nivelAcceso: nivel ?? { $ne: 'super_admin' },
    };
    if (region !== undefined) query.districtId = region;
    if (q) query.name = { $regex: escapeRegex(q), $options: 'i' };

    const [items, total] = await Promise.all([
      this.userModel
        .find(query)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('roles', 'nombre status')
        .exec(),
      this.userModel.countDocuments(query).exec(),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Regiones distintas presentes entre los usuarios gestionables. Alimenta el
   * `<select>` de región del panel: sin esto el filtro exigiría adivinar IDs.
   */
  async distinctRegions(): Promise<
    { districtId: number; districtName: string }[]
  > {
    const rows = await this.userModel
      .aggregate<{ _id: number; districtName: string }>([
        {
          $match: {
            districtId: { $ne: null },
            estadoAcceso: { $in: ['aprobado', 'suspendido'] },
          },
        },
        {
          $group: {
            _id: '$districtId',
            districtName: { $first: '$districtName' },
          },
        },
        { $sort: { districtName: 1 } },
      ])
      .exec();

    return rows.map((r) => ({
      districtId: r._id,
      districtName: r.districtName,
    }));
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .populate('roles', 'nombre status')
      .exec();

    if (!user) {
      throw new AppNotFoundException(K.USERS.NOT_FOUND, { id });
    }

    return user;
  }

  /**
   * Edita un usuario. Aquí vive la gestión de acceso (nivel, estado, territorio),
   * protegida por dos invariantes:
   *   1. Nadie modifica su propio acceso (evita que un admin se auto-escale).
   *   2. Al super_admin no se le gestiona desde el panel.
   */
  async update(
    actorId: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserDocument> {
    if (actorId === id && touchesAccess(dto)) {
      throw new AppForbiddenException(K.USERS.CANNOT_MODIFY_OWN_ACCESS);
    }

    const target = await this.userModel.findById(id).exec();
    if (!target) {
      throw new AppNotFoundException(K.USERS.NOT_FOUND, { id });
    }
    if (target.nivelAcceso === 'super_admin') {
      throw new AppForbiddenException(K.USERS.CANNOT_MANAGE_SUPER_ADMIN);
    }

    try {
      target.set(dto);
      const saved = await target.save();
      await this.currentUser.refresh(saved.idSiscout);
      return saved;
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppConflictException(K.USERS.SISCOUT_ID_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.userModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new AppNotFoundException(K.USERS.NOT_FOUND, { id });
    }

    await this.currentUser.invalidate(deleted.idSiscout);
  }
}
