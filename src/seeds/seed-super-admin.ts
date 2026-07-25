import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { hash } from 'bcryptjs';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import type { AppConfigService } from '../config';
import { CEDULA_HASHER, type CedulaHasher } from '../crypto';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

const ROLE_NAME = 'super_admin';
const PERMISSIONS = ['*'];
const BCRYPT_ROUNDS = 12;

/**
 * Seed de arranque de un solo uso: crea el rol super_admin (con permisos) y
 * una persona super admin lista para iniciar sesión y aprobar a las demás.
 * Idempotente: si la persona ya existe (p. ej. sincronizada), la eleva.
 */
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const roleModel = app.get<Model<RoleDocument>>(getModelToken(Role.name), {
      strict: false,
    });
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name), {
      strict: false,
    });
    const cedulaHasher = app.get<CedulaHasher>(CEDULA_HASHER);
    const config = app.get<AppConfigService>(ConfigService);

    if (!cedulaHasher.isReady()) {
      throw new Error(
        'CEDULA_HASH_KEY no está configurada: no se puede sembrar el super admin.',
      );
    }

    const cedula = config.get('CEDULA_SUPER_ADMIN', { infer: true });
    const password = config.get('PASSWORD_SUPER_ADMIN', { infer: true });
    if (!cedula || !password) {
      throw new Error(
        'Define CEDULA_SUPER_ADMIN y PASSWORD_SUPER_ADMIN (opcionales, de un solo uso) antes de sembrar el super admin.',
      );
    }

    const role = await roleModel
      .findOneAndUpdate(
        { nombre: ROLE_NAME },
        {
          $set: {
            descripcion: 'Acceso total al panel de administración',
            permissions: PERMISSIONS,
            status: 'activo',
            esSistema: true,
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();
    if (!role) {
      throw new Error('No se pudo crear ni recuperar el rol super_admin.');
    }
    const roleId = role._id;

    const cedulaHash = cedulaHasher.hash(cedula);
    const passwordHash = await hash(password, BCRYPT_ROUNDS);

    const existing = await userModel.findOne({ cedulaHash }).exec();
    if (existing) {
      existing.estado = true;
      existing.estadoAcceso = 'aprobado';
      existing.nivelAcceso = 'super_admin';
      existing.passwordHash = passwordHash;
      if (!existing.roles.some((id) => String(id) === String(roleId))) {
        existing.roles.push(roleId);
      }
      await existing.save();
      console.log(
        `Super admin actualizado sobre la persona existente (idSiscout=${existing.idSiscout}).`,
      );
    } else {
      await userModel.create({
        name: 'Super Admin',
        tipo: 'adulto',
        idSiscout: `seed-super-admin-${cedula}`,
        cedulaHash,
        estado: true,
        estadoSiscout: false,
        estadoAcceso: 'aprobado',
        nivelAcceso: 'super_admin',
        roles: [roleId],
        passwordHash,
      });
      console.log('Super admin creado.');
    }

    console.log(
      `✔ Seed listo — cédula ${cedula}, rol '${ROLE_NAME}' [${PERMISSIONS.join(', ')}].`,
    );
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✖ Seed del super admin falló:', error);
    process.exit(1);
  });
