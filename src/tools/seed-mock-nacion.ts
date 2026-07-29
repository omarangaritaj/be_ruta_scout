import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import type { SiscoutMember } from '../siscout/normalize';
import { SiscoutSyncService } from '../siscout/siscout-sync.service';

/**
 * Crea un usuario mock (adulto) por la MISMA vía que una importación real:
 * snapshot cifrado + proyección a `users`. Sirve para probar a mano el flujo de
 * solicitud de acceso de nivel nación y la recepción del correo.
 *
 * Queda en `estadoAcceso: 'sin_solicitud'` y SIN contraseña, así que al entrar
 * con su cédula el flujo lo trata como "nuevo" (registro → onboarding → solicitar).
 * Idempotente: reejecutar hace upsert por idSiscout, no duplica.
 */
const MOCK: SiscoutMember = {
  person_id: '00123',
  citizenship_card: '1099999999',
  nombre: 'Nación Mock Prueba',
  edad: 40,
  sex: 'M',
  telefono: '3000000000',
  email: '00123@test.com',
  cargo: 'JEFE SCOUT NACIONAL',
  cargo_id: null,
  tipomiembro: 'MIEMBRO ACTIVO ADULTO',
  group_id: 1,
  group_name: 'GRUPO MOCK',
  district_id: 1,
  district_name: 'BOGOTA',
  zone_id: 1,
};

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const sync = app.get(SiscoutSyncService, { strict: false });
    const result = await sync.importMembers([MOCK]);
    console.log(
      `✔ Mock nación listo — creados=${result.created} actualizados=${result.updated}.\n` +
        `  Cédula:  ${MOCK.citizenship_card}\n` +
        `  Correo:  ${MOCK.email}\n` +
        `  Entra en /login con la cédula → registra contraseña → onboarding → solicita NACIÓN.`,
    );
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('✖ Seed del mock nación falló:', error);
    process.exit(1);
  });
