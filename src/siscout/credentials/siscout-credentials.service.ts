import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  AppConflictException,
  AppNotFoundException,
  AppServiceUnavailableException,
} from '../../common';
import { CREDENTIALS_CIPHER, FieldCipher, isEncrypted } from '../../crypto';
import { K } from '../../i18n';
import type { CreateSiscoutCredentialDto } from './dto/create-siscout-credential.dto';
import type { AlcanceDto } from './dto/siscout-credential-base.schema';
import type { UpdateSiscoutCredentialDto } from './dto/update-siscout-credential.dto';
import {
  SiscoutCredential,
  type AlcanceCredencial,
} from './siscout-credential.entity';

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

/**
 * El DTO nacional no trae `zoneIds`; se materializa el `[]` que declara la
 * entity para que el jsonb guardado tenga siempre la misma forma.
 */
function toAlcance(alcance: AlcanceDto): AlcanceCredencial {
  return {
    tipo: alcance.tipo,
    zoneIds: alcance.tipo === 'zonas' ? alcance.zoneIds : [],
  };
}

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
  descripcion?: string | null;
  usuario: string;
  changeRolPath: string;
  alcance: AlcanceCredencial;
  prioridad: number;
  activa: boolean;
  ultimoUsoEn?: Date | null;
  ultimoErrorEn?: Date | null;
  ultimoError?: string | null;
}

/**
 * Pool de credenciales de SiScout, editable en tiempo de ejecución.
 */
@Injectable()
export class SiscoutCredentialsService {
  private readonly logger = new Logger(SiscoutCredentialsService.name);

  constructor(
    @InjectRepository(SiscoutCredential)
    private readonly credentials: Repository<SiscoutCredential>,
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

    const candidates = await this.credentials
      .createQueryBuilder('credential')
      // El password lleva `select: false`: este es el ÚNICO punto que lo lee.
      .addSelect('credential.password')
      .where('credential.activa = true')
      .andWhere(
        "(credential.alcance ->> 'tipo' = 'nacional' OR " +
          "(credential.alcance ->> 'tipo' = 'zonas' AND " +
          "credential.alcance -> 'zoneIds' @> :zona::jsonb))",
        { zona: JSON.stringify([zoneId]) },
      )
      .getMany();

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
    await this.credentials.update(
      { nombre },
      { ultimoUsoEn: new Date(), ultimoError: null },
    );
  }

  async registrarError(nombre: string, mensaje: string): Promise<void> {
    await this.credentials.update(
      { nombre },
      { ultimoErrorEn: new Date(), ultimoError: mensaje },
    );
  }

  // --- Gestión ---

  async create(
    dto: CreateSiscoutCredentialDto,
  ): Promise<SiscoutCredentialView> {
    this.requireCipher();

    const { password, alcance, ...rest } = dto;

    try {
      const created = await this.credentials.save(
        this.credentials.create({
          ...rest,
          alcance: toAlcance(alcance),
          password: this.cipher.encrypt(password),
        }),
      );

      this.logger.log(`Credencial '${dto.nombre}' creada`);

      return this.toView(created);
    } catch (error) {
      throw this.translateDuplicate(error, dto.nombre);
    }
  }

  async findAll(): Promise<SiscoutCredentialView[]> {
    const credentials = await this.credentials.find({
      order: { prioridad: 'ASC', nombre: 'ASC' },
    });

    return credentials.map((credential) => this.toView(credential));
  }

  async findOne(nombre: string): Promise<SiscoutCredentialView> {
    const credential = await this.credentials.findOne({ where: { nombre } });

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
    const { password, alcance, ...rest } = dto;
    const patch: QueryDeepPartialEntity<SiscoutCredential> = { ...rest };

    if (alcance !== undefined) {
      patch.alcance = toAlcance(alcance);
    }

    // La contraseña llega en claro y se cifra aquí: es el único punto por el
    // que un valor en claro entra a la tabla.
    if (password !== undefined) {
      this.requireCipher();
      patch.password = this.cipher.encrypt(password);
    }

    try {
      const result = await this.credentials.update({ nombre }, patch);

      if (result.affected === 0) {
        throw new AppNotFoundException(K.SISCOUT.CREDENTIAL_NOT_FOUND, {
          nombre,
        });
      }

      this.logger.log(
        `Credencial '${nombre}' actualizada: ${Object.keys(patch).join(', ')}`,
      );

      return this.findOne(dto.nombre ?? nombre);
    } catch (error) {
      if (error instanceof AppNotFoundException) throw error;
      throw this.translateDuplicate(error, dto.nombre ?? nombre);
    }
  }

  async remove(nombre: string): Promise<void> {
    const { affected } = await this.credentials.delete({ nombre });

    if (!affected) {
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
   * añada mañana a la entity quedaría expuesto por omisión y el fallo sería
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
    if (isDuplicateKey(error)) {
      return new AppConflictException(K.SISCOUT.CREDENTIAL_ALREADY_EXISTS, {
        nombre,
      });
    }
    return error;
  }
}
