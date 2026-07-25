import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import { Role, RoleDocument } from './schemas/role.schema';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
  ) {}

  list(): Promise<RoleDocument[]> {
    return this.roleModel.find().sort({ nombre: 1 }).exec();
  }

  async findOne(id: string): Promise<RoleDocument> {
    const role = await this.roleModel.findById(id).exec();
    if (!role) throw new NotFoundException(`No existe el rol "${id}"`);
    return role;
  }

  async create(dto: CreateRoleDto): Promise<RoleDocument> {
    const existe = await this.roleModel.findOne({ nombre: dto.nombre }).exec();
    if (existe) throw new ConflictException('Ya existe un rol con ese nombre');
    return this.roleModel.create(dto);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleDocument> {
    const role = await this.findOne(id);

    // Un rol del sistema no puede cambiar sus permisos ni desactivarse; sí su
    // descripción. Es la salvaguarda para no dejar al super_admin sin poderes.
    if (role.esSistema) {
      if (dto.permissions || dto.status === 'inactivo' || dto.nombre) {
        throw new BadRequestException(
          'No se pueden alterar los permisos, el nombre ni el estado de un rol del sistema',
        );
      }
    }

    if (dto.nombre && dto.nombre !== role.nombre) {
      const existe = await this.roleModel
        .findOne({ nombre: dto.nombre, _id: { $ne: role._id } })
        .exec();
      if (existe)
        throw new ConflictException('Ya existe un rol con ese nombre');
    }

    if (dto.nombre !== undefined) role.nombre = dto.nombre;
    if (dto.descripcion !== undefined) role.descripcion = dto.descripcion;
    if (dto.permissions !== undefined) role.permissions = dto.permissions;
    if (dto.status !== undefined) role.status = dto.status;
    await role.save();
    return role;
  }

  async remove(id: string): Promise<void> {
    const role = await this.findOne(id);
    if (role.esSistema) {
      throw new BadRequestException('No se puede eliminar un rol del sistema');
    }
    await role.deleteOne();
  }
}
