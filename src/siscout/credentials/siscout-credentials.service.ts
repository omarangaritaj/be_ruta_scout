import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AppConflictException,
  AppNotFoundException,
  AppServiceUnavailableException,
} from '../../common';
import { CREDENTIALS_CIPHER, FieldCipher, isEncrypted } from '../../crypto';
import { K } from '../../i18n';
import type { CreateSiscoutCredentialDto } from './dto/create-siscout-credential.dto';
import type { UpdateSiscoutCredentialDto } from './dto/update-siscout-credential.dto';
import {
  SiscoutCredential,
  SiscoutCredentialDocument,
  type AlcanceCredencial,
} from './schemas/siscout-credential.schema';

/**
 * Credencial lista para autenticarse, con la contraseña ya en claro.
 *
 * Solo la produce este servicio y solo vive en memoria durante el login. No se
 * cachea ni se devuelve por ningún endpoint.
 */
export interface SiscoutCredentialAuth {
  nombre: string;
  usuario: string;
  password: string;
  changeRolPath: string;
}

/** Vista pública de una credencial: todo menos la contraseña. */
export interface SiscoutCredentialView {
  nombre: string;
  descripcion?: string;
  usuario: string;
  changeRolPath: string;
  alcance: AlcanceCredencial;
  prioridad: number;
  activa: boolean;
  ultimoUsoEn?: Date;
  ultimoErrorEn?: Date;
  ultimoError?: string;
}

/**
 * Pool de credenciales de SiScout, editable en tiempo de ejecución.
 */
@Injectable()
export class SiscoutCredentialsService {
  private readonly logger = new Logger(SiscoutCredentialsService.name);

  constructor(
    @InjectModel(SiscoutCredential.name)
    private readonly credentialModel: Model<SiscoutCredentialDocument>,
    @Inject(CREDENTIALS_CIPHER)
    private readonly cipher: FieldCipher,
  ) {}

  /** Indica si hay clave para cifrar y descifrar contraseñas. */
  isReady(): boolean {
    return this.cipher.isReady();
  }

  // --- Resolución para la sincronización ---

  /**
   * Credenciales capaces de leer una zona, en el orden en que hay que
   * intentarlas.
   *
   * Primero las que declaran esa zona explícitamente y después las nacionales:
   * una cuenta acotada a su zona es la que menos privilegio arrastra, y la
   * nacional queda como último recurso. Dentro de cada grupo manda `prioridad`,
   * y el nombre desempata para que el orden sea siempre el mismo.
   *
   * Devuelve una LISTA, no una credencial: es lo que permite al motor pasar a
   * la siguiente cuando un login falla.
   */
  async resolveForZone(zoneId: number): Promise<SiscoutCredentialAuth[]> {
    if (!this.cipher.isReady()) {
      throw new AppServiceUnavailableException(
        K.SISCOUT.MISSING_CREDENTIALS_KEY_READ,
      );
    }

    const candidates = await this.credentialModel
      .find({
        activa: true,
        $or: [
          { 'alcance.tipo': 'nacional' },
          { 'alcance.tipo': 'zonas', 'alcance.zoneIds': zoneId },
        ],
      })
      .select('+password')
      .lean()
      .exec();

    return candidates
      .sort((a, b) => {
        const especificidad =
          this.especificidad(a.alcance) - this.especificidad(b.alcance);
        if (especificidad !== 0) return especificidad;

        const prioridad = a.prioridad - b.prioridad;
        if (prioridad !== 0) return prioridad;

        return a.nombre.localeCompare(b.nombre);
      })
      .map((credential) => this.toAuth(credential));
  }

  /** Menor es más específico: la zona concreta gana a la nacional. */
  private especificidad(alcance: AlcanceCredencial): number {
    return alcance.tipo === 'zonas' ? 0 : 1;
  }

  private toAuth(credential: SiscoutCredential): SiscoutCredentialAuth {
    if (!isEncrypted(credential.password)) {
      throw new Error(
        `La credencial '${credential.nombre}' tiene la contraseña sin cifrar: ` +
          `se descarta antes de usarla`,
      );
    }

    return {
      nombre: credential.nombre,
      usuario: credential.usuario,
      password: this.cipher.decrypt(credential.password),
      changeRolPath: credential.changeRolPath,
    };
  }

  // --- Rastro de uso: sin esto, un failover silencioso esconde una caída ---

  async registrarUso(nombre: string): Promise<void> {
    await this.credentialModel
      .updateOne(
        { nombre },
        { $set: { ultimoUsoEn: new Date() }, $unset: { ultimoError: '' } },
      )
      .exec();
  }

  async registrarError(nombre: string, mensaje: string): Promise<void> {
    await this.credentialModel
      .updateOne(
        { nombre },
        { $set: { ultimoErrorEn: new Date(), ultimoError: mensaje } },
      )
      .exec();
  }

  // --- Gestión ---

  async create(
    dto: CreateSiscoutCredentialDto,
  ): Promise<SiscoutCredentialView> {
    this.requireCipher();

    const { password, ...rest } = dto;

    try {
      const created = await this.credentialModel.create({
        ...rest,
        password: this.cipher.encrypt(password),
      });

      this.logger.log(`Credencial '${dto.nombre}' creada`);

      return this.toView(created.toObject());
    } catch (error) {
      throw this.translateDuplicate(error, dto.nombre);
    }
  }

  async findAll(): Promise<SiscoutCredentialView[]> {
    const credentials = await this.credentialModel
      .find()
      .sort({ prioridad: 1, nombre: 1 })
      .lean()
      .exec();

    return credentials.map((credential) => this.toView(credential));
  }

  async findOne(nombre: string): Promise<SiscoutCredentialView> {
    const credential = await this.credentialModel
      .findOne({ nombre })
      .lean()
      .exec();

    if (!credential) {
      throw new AppNotFoundException(K.SISCOUT.CREDENTIAL_NOT_FOUND, {
        nombre,
      });
    }

    return this.toView(credential);
  }

  async update(
    nombre: string,
    dto: UpdateSiscoutCredentialDto,
  ): Promise<SiscoutCredentialView> {
    const { password, ...rest } = dto;
    const patch: Record<string, unknown> = { ...rest };

    // La contraseña llega en claro y se cifra aquí: es el único punto por el
    // que un valor en claro entra a la colección.
    if (password !== undefined) {
      this.requireCipher();
      patch.password = this.cipher.encrypt(password);
    }

    try {
      const updated = await this.credentialModel
        .findOneAndUpdate(
          { nombre },
          { $set: patch },
          { returnDocument: 'after' },
        )
        .lean()
        .exec();

      if (!updated) {
        throw new AppNotFoundException(K.SISCOUT.CREDENTIAL_NOT_FOUND, {
          nombre,
        });
      }

      this.logger.log(
        `Credencial '${nombre}' actualizada: ${Object.keys(patch).join(', ')}`,
      );

      return this.toView(updated);
    } catch (error) {
      if (error instanceof AppNotFoundException) throw error;
      throw this.translateDuplicate(error, dto.nombre ?? nombre);
    }
  }

  async remove(nombre: string): Promise<void> {
    const { deletedCount } = await this.credentialModel
      .deleteOne({ nombre })
      .exec();

    if (deletedCount === 0) {
      throw new AppNotFoundException(K.SISCOUT.CREDENTIAL_NOT_FOUND, {
        nombre,
      });
    }

    this.logger.log(`Credencial '${nombre}' eliminada`);
  }

  // --- Auxiliares ---

  private requireCipher(): void {
    if (!this.cipher.isReady()) {
      throw new AppServiceUnavailableException(
        K.SISCOUT.MISSING_CREDENTIALS_KEY_WRITE,
      );
    }
  }

  /**
   * La vista pública se construye campo a campo, NO quitando la contraseña de
   * una copia. Con una lista de bloqueados, cualquier campo sensible que se
   * añada mañana al esquema quedaría expuesto por omisión y el fallo sería
   * silencioso.
   */
  private toView(credential: SiscoutCredential): SiscoutCredentialView {
    return {
      nombre: credential.nombre,
      descripcion: credential.descripcion,
      usuario: credential.usuario,
      changeRolPath: credential.changeRolPath,
      alcance: {
        tipo: credential.alcance.tipo,
        zoneIds: credential.alcance.zoneIds ?? [],
      },
      prioridad: credential.prioridad,
      activa: credential.activa,
      ultimoUsoEn: credential.ultimoUsoEn,
      ultimoErrorEn: credential.ultimoErrorEn,
      ultimoError: credential.ultimoError,
    };
  }

  /** El índice único de `nombre` se traduce a un 409, no a un 500. */
  private translateDuplicate(error: unknown, nombre: string): unknown {
    if ((error as { code?: number }).code === 11000) {
      return new AppConflictException(K.SISCOUT.CREDENTIAL_ALREADY_EXISTS, {
        nombre,
      });
    }
    return error;
  }
}
