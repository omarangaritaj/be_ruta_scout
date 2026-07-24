import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { CreateUserDto } from './dto/create-user.dto';
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

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    try {
      return await this.userModel.create(dto);
    } catch (error) {
      // `idSiscout` es único: sin esto Mongoose devolvería un 500 opaco.
      if (isDuplicateKey(error)) {
        throw new ConflictException('Ya existe una persona con ese idSiscout');
      }
      throw error;
    }
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException(`No existe un usuario con id "${id}"`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    let user: UserDocument | null;

    try {
      user = await this.userModel
        .findByIdAndUpdate(id, dto, {
          returnDocument: 'after',
          runValidators: true,
        })
        .exec();
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictException('Ya existe una persona con ese idSiscout');
      }
      throw error;
    }

    if (!user) {
      throw new NotFoundException(`No existe un usuario con id "${id}"`);
    }

    return user;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.userModel.findByIdAndDelete(id).exec();

    if (!deleted) {
      throw new NotFoundException(`No existe un usuario con id "${id}"`);
    }
  }
}
