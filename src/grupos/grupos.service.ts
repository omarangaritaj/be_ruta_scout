import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppNotFoundException } from '../common';
import { K } from '../i18n';
import type { CreateGrupoDto } from './dto/create-grupo.dto';
import type { UpdateGrupoDto } from './dto/update-grupo.dto';
import { Grupo, GrupoDocument } from './schemas/grupo.schema';

@Injectable()
export class GruposService {
  constructor(
    @InjectModel(Grupo.name)
    private readonly grupoModel: Model<GrupoDocument>,
  ) {}

  async create(dto: CreateGrupoDto): Promise<GrupoDocument> {
    return this.grupoModel.create(dto);
  }

  async findAll(): Promise<GrupoDocument[]> {
    return this.grupoModel.find().exec();
  }

  async findOne(id: string): Promise<GrupoDocument> {
    const grupo = await this.grupoModel.findById(id).exec();

    if (!grupo) {
      throw new AppNotFoundException(K.GROUPS.NOT_FOUND, { id });
    }

    return grupo;
  }

  async update(id: string, dto: UpdateGrupoDto): Promise<GrupoDocument> {
    const grupo = await this.grupoModel
      .findByIdAndUpdate(id, dto, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();

    if (!grupo) {
      throw new AppNotFoundException(K.GROUPS.NOT_FOUND, { id });
    }

    return grupo;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.grupoModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new AppNotFoundException(K.GROUPS.NOT_FOUND, { id });
    }
  }
}
