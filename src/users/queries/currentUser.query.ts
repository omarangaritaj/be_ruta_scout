import type { PipelineStage } from 'mongoose';
import type { Role } from '../../roles/schemas/role.schema';
import type { User } from '../schemas/user.schema';

/**
 * Perfil del usuario actual: el documento de `users` enriquecido con el cargo
 * proyectado del snapshot de SiScout y con los roles poblados. Es lo que se
 * cachea en Redis bajo `current_user:<idSiscout>`.
 *
 * Se omiten del tipo (y del pipeline) los secretos y los campos internos, así
 * que lo que se cachea nunca incluye `passwordHash` ni `cedulaHash`.
 */
export interface CurrentUser extends Omit<
  User,
  'roles' | 'passwordHash' | 'cedulaHash'
> {
  _id: string;
  cargoSiscout?: string;
  roles: Role[];
}

/**
 * Pipeline que arma el `CurrentUser` a partir de `idSiscout`: une el snapshot de
 * SiScout (para el cargo) y los roles, y descarta los campos internos y los
 * secretos.
 *
 * `preserveNullAndEmptyArrays` en el snapshot deja pasar a quien no tenga uno
 * (p. ej. el super admin sembrado), que queda con `cargoSiscout` indefinido en
 * vez de desaparecer del resultado.
 */
export const currenUserAggregation = (idSiscout: string): PipelineStage[] => [
  {
    $match: {
      idSiscout,
    },
  },
  {
    $lookup: {
      from: 'siscout_snapshots',
      localField: 'idSiscout',
      foreignField: 'idSiscout',
      as: 'snapshot',
    },
  },
  {
    $unwind: {
      path: '$snapshot',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $lookup: {
      from: 'roles',
      localField: 'roles',
      foreignField: '_id',
      as: 'roles',
    },
  },
  {
    $addFields: {
      cargoSiscout: '$snapshot.payload.cargo',
    },
  },
  {
    $project: {
      cedulaHash: 0,
      passwordHash: 0,
      sincronizadoEn: 0,
      snapshot: 0,
      ultimoSyncId: 0,
      updatedAt: 0,
      __v: 0,
    },
  },
];
