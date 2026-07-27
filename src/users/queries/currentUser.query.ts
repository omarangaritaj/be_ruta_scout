import type { PipelineStage } from 'mongoose';
import type { Role } from '../../roles/schemas/role.schema';
import type { User } from '../schemas/user.schema';

/**
 * Perfil del usuario actual: el documento de `users` con los roles poblados. Es
 * lo que se cachea en Redis bajo `current_user:<idSiscout>`.
 *
 * Se omiten del tipo (y del pipeline) los secretos y los campos internos, así
 * que lo que se cachea nunca incluye `passwordHash` ni `cedulaHash`.
 */
export interface CurrentUser extends Omit<
  User,
  'roles' | 'passwordHash' | 'cedulaHash'
> {
  _id: string;
  roles: Role[];
}

/**
 * Pipeline que arma el `CurrentUser` a partir de `idSiscout`: puebla los roles y
 * descarta los campos internos y los secretos.
 *
 * `cargoSiscout` ya vive en el documento público —lo proyecta el sync desde la
 * lista de permitidos—, así que este pipeline NO toca `siscout_snapshots`. Es
 * deliberado: es el camino del login y no tiene por qué leer la colección
 * privada por un dato que no es PII. Quien nunca haya venido de una
 * sincronización (el super admin sembrado) simplemente no lo trae.
 */
export const currenUserAggregation = (idSiscout: string): PipelineStage[] => [
  {
    $match: {
      idSiscout,
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
    $project: {
      cedulaHash: 0,
      passwordHash: 0,
      sincronizadoEn: 0,
      ultimoSyncId: 0,
      updatedAt: 0,
      __v: 0,
    },
  },
];
