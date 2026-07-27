import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import {
  cargosDeJefaturaDeRama,
  ramaDeCargo,
} from '../catalogo-cargos/catalogo-cargos';
import { ramaDeEtiquetaSiscout, type Rama } from '../catalogo-cargos/ramas';
import { AppBadRequestException, AppNotFoundException } from '../common';
import { CurrentUserService } from '../current-user/current-user.service';
import { BRANCH_MESSAGE_KEY } from '../domain';
import { K, t } from '../i18n';
import type { CurrentUser } from '../users/queries/currentUser.query';
import { User, UserDocument } from '../users/schemas/user.schema';
import { resolverAlcance } from './alcance-unidades';
import type { CreateUnidadDto } from './dto/create-unidad.dto';
import type { UpdateUnidadDto } from './dto/update-unidad.dto';
import { Unidad, UnidadDocument } from './schemas/unidad.schema';

const CLAVE_DUPLICADA = 11000;

function esClaveDuplicada(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === CLAVE_DUPLICADA
  );
}

@Injectable()
export class UnidadesService {
  private readonly logger = new Logger(UnidadesService.name);

  constructor(
    @InjectModel(Unidad.name)
    private readonly unidadModel: Model<UnidadDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly currentUser: CurrentUserService,
  ) {}

  async create(dto: CreateUnidadDto): Promise<UnidadDocument> {
    return this.unidadModel.create(dto);
  }

  async findAll(user: AuthUser): Promise<UnidadDocument[]> {
    const perfil = await this.currentUser.get(user.idSiscout!);
    const alcance = resolverAlcance(perfil);

    switch (alcance.type) {
      case 'all':
        return this.unidadModel.find().exec();

      case 'grupo':
        return this.unidadModel.find({ groupId: alcance.groupId }).exec();

      case 'rama':
        return this.deRama(alcance.rama, alcance.groupId, perfil);

      case 'sin-grupo':
        throw new AppBadRequestException(K.UNITS.MISSING_GROUP);

      case 'jefatura-requerida':
        throw new AppBadRequestException(
          K.UNITS.LEADERSHIP_REQUIRED,
          undefined,
          { jefaturas: cargosDeJefaturaDeRama() },
        );
    }
  }

  /**
   * Registra la jefatura de rama que la persona declara cuando su cargo de
   * SiScout no la determina, y devuelve ya su unidad.
   */
  async declararJefatura(
    user: AuthUser,
    nombreCargo: string,
  ): Promise<UnidadDocument[]> {
    const rama = ramaDeCargo(nombreCargo);
    if (!rama) {
      throw new AppBadRequestException(K.UNITS.LEADERSHIP_NOT_A_BRANCH, {
        cargo: nombreCargo,
      });
    }

    const perfil = await this.currentUser.get(user.idSiscout!);
    if (!perfil.groupId) {
      throw new AppBadRequestException(K.UNITS.MISSING_GROUP);
    }

    await this.userModel
      .updateOne(
        { _id: perfil._id, 'cargos.nombreCargo': { $ne: nombreCargo } },
        { $push: { cargos: { nombreCargo, nivel: 'rama' } } },
      )
      .exec();
    await this.currentUser.refresh(user.idSiscout!);

    return this.deRama(rama, perfil.groupId, perfil);
  }

  async findOne(id: string): Promise<UnidadDocument> {
    const unidad = await this.unidadModel.findById(id).exec();

    if (!unidad) {
      throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });
    }

    return unidad;
  }

  async update(id: string, dto: UpdateUnidadDto): Promise<UnidadDocument> {
    const unidad = await this.unidadModel
      .findByIdAndUpdate(id, dto, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();

    if (!unidad) {
      throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });
    }

    return unidad;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.unidadModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new AppNotFoundException(K.UNITS.NOT_FOUND, { id });
    }
  }

  private async deRama(
    rama: Rama,
    groupId: number,
    perfil: CurrentUser,
  ): Promise<UnidadDocument[]> {
    const existentes = await this.unidadModel.find({ groupId, rama }).exec();
    if (existentes.length > 0) return existentes;

    return [await this.provisionar(rama, groupId, perfil)];
  }

  /**
   * Crea la unidad de la rama con los protagonistas que ya pertenecen a ella.
   *
   * El índice único `{groupId, rama}` es el árbitro cuando dos dirigentes de la
   * misma rama entran a la vez: quien pierde la carrera lee la unidad que ganó
   * en vez de crear una duplicada.
   */
  private async provisionar(
    rama: Rama,
    groupId: number,
    perfil: CurrentUser,
  ): Promise<UnidadDocument> {
    const protagonistas = await this.protagonistasDe(rama, groupId);

    try {
      return await this.unidadModel.create({
        nombre: t(BRANCH_MESSAGE_KEY[rama]),
        rama,
        groupId,
        idJefeUnidad: new Types.ObjectId(perfil._id),
        dirigentes: [],
        protagonistas,
      });
    } catch (error) {
      if (!esClaveDuplicada(error)) throw error;

      this.logger.debug(
        `provisionar — la unidad ${rama}/${groupId} ya la creó otra petición`,
      );
      const ganadora = await this.unidadModel.findOne({ groupId, rama }).exec();
      if (!ganadora) throw error;
      return ganadora;
    }
  }

  /**
   * La rama de un protagonista vive en `cargoSiscout` como texto de SiScout, no
   * como campo propio, así que se resuelve en memoria con el catálogo de alias
   * en vez de filtrarse en Mongo: el conjunto por grupo es pequeño y así tolera
   * tildes, plurales y mayúsculas.
   */
  private async protagonistasDe(
    rama: Rama,
    groupId: number,
  ): Promise<Types.ObjectId[]> {
    const candidatos = await this.userModel
      .find({ tipo: 'protagonista', groupId, estado: true })
      .select('_id cargoSiscout')
      .lean<{ _id: Types.ObjectId; cargoSiscout?: string }[]>()
      .exec();

    return candidatos
      .filter((p) => ramaDeEtiquetaSiscout(p.cargoSiscout) === rama)
      .map((p) => p._id);
  }
}
