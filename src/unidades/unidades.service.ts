import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppNotFoundException } from '../common';
import { K } from '../i18n';
import type { CreateUnidadDto } from './dto/create-unidad.dto';
import type { UpdateUnidadDto } from './dto/update-unidad.dto';
import { Unidad, UnidadDocument } from './schemas/unidad.schema';

@Injectable()
export class UnidadesService {
  constructor(
    @InjectModel(Unidad.name)
    private readonly unidadModel: Model<UnidadDocument>,
  ) {}

  async create(dto: CreateUnidadDto): Promise<UnidadDocument> {
    return this.unidadModel.create(dto);
  }

  async findAll(): Promise<UnidadDocument[]> {
    return this.unidadModel.find().exec();
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
}
