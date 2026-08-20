import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { BCRYPT_ROUNDS } from '../auth/password-hashing';
import type { AppConfigService } from '../config';
import { CEDULA_HASHER, type CedulaHasher } from '../crypto';
import { D } from '../domain';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

// eslint-disable-next-line no-restricted-syntax -- nombre del registro en `roles`, no el enum nivelAcceso
const ROLE_NAME = 'super_admin';
const PERMISSIONS = ['*'];
const RESOURCES = ['*'];

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
    const dataSource = app.get(DataSource);
    const roles = dataSource.getRepository(Role);
    const users = dataSource.getRepository(User);
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

    let role = await roles.findOne({ where: { nombre: ROLE_NAME } });
    if (!role) {
      role = roles.create({ nombre: ROLE_NAME });
    }
    role.descripcion = 'Acceso total al panel de administración';
    role.permissions = PERMISSIONS;
    role.resources = RESOURCES;
    role.status = 'activo';
    role.esSistema = true;
    role = await roles.save(role);

    const cedulaHash = cedulaHasher.hash(cedula);
    const passwordHash = await hash(password, BCRYPT_ROUNDS);

    const existing = await users
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .addSelect(['user.cedulaHash', 'user.passwordHash'])
      .where('user.cedulaHash = :cedulaHash', { cedulaHash })
      .getOne();

    if (existing) {
      existing.estado = true;
      existing.estadoAcceso = D.ACCESS_STATE.APPROVED;
      existing.nivelAcceso = D.ACCESS_LEVEL.SUPER_ADMIN;
      existing.passwordHash = passwordHash;
      if (!existing.roles.some((r) => r.id === role.id)) {
        existing.roles.push(role);
      }
      await users.save(existing);
      console.log(
        `Super admin actualizado sobre la persona existente (idSiscout=${existing.idSiscout}).`,
      );
    } else {
      await users.save(
        users.create({
          name: 'Super Admin',
          tipo: D.PERSON_TYPE.ADULT,
          idSiscout: `seed-super-admin-${cedula}`,
          cedulaHash,
          estado: true,
          estadoSiscout: false,
          estadoAcceso: D.ACCESS_STATE.APPROVED,
          nivelAcceso: D.ACCESS_LEVEL.SUPER_ADMIN,
          roles: [role],
          passwordHash,
        }),
      );
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
