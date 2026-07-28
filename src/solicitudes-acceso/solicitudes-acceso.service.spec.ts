import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EscalationService } from '../authz/escalation.service';
import { PermissionsService } from '../authz/permissions.service';
import { SolicitudesAccesoService } from './solicitudes-acceso.service';

const ACTOR = 'actor-1';

interface SolicitudMock {
  idPersona: string;
  nivelSolicitado: string;
  cargoSolicitado: string;
  estado: string;
  nivelAprobado?: string;
  notaAprobador?: string;
  resueltoEn?: Date;
  save: jest.Mock;
}

function solicitudMock(): SolicitudMock {
  return {
    idPersona: 'p1',
    nivelSolicitado: 'grupo',
    cargoSolicitado: 'JEFE DE GRUPO',
    estado: 'pendiente',
    save: jest.fn(() => Promise.resolve()),
  };
}

/**
 * Imita una Query de Mongoose: solo `.exec()`, que es lo único que el servicio
 * invoca. Resuelve al valor dado, nunca al propio objeto: un doble que
 * devolviera `this` (siempre truthy) dejaría pasar cualquier guarda montada
 * sobre el resultado aunque el código real la rompiera. Mismo helper que
 * `roles.service.spec.ts`.
 */
function chain<T>(result: T): { exec: jest.Mock<Promise<T>, unknown[]> } {
  return { exec: jest.fn(() => Promise.resolve(result)) };
}

/**
 * El `EscalationService` es el REAL, con `PermissionsService` falseado: así el
 * test cubre la comparación de niveles de verdad y no solo que alguien sea
 * invocado. `nivelActor` es el nivel de quien aprueba y NO tiene valor por
 * defecto a propósito: con uno, pasar `undefined` (el caso "actor sin nivel")
 * lo dispararía y el test probaría lo contrario de lo que dice su nombre.
 */
function service(solicitud: unknown, nivelActor: string | undefined) {
  const solicitudModel = {
    findById: () => chain(solicitud),
  };
  const userModel = {
    updateOne: jest.fn(() => chain({})),
    findById: () => chain(null),
  };
  const notificador = { encolar: jest.fn(() => Promise.resolve()) };
  const email = {
    sendSolicitudRecibida: jest.fn(() => Promise.resolve()),
    sendSolicitudResuelta: jest.fn(() => Promise.resolve()),
    sendPasswordReset: jest.fn(() => Promise.resolve()),
  };
  const permissions = {
    effectiveLevel: jest.fn(() => Promise.resolve(nivelActor)),
  } as unknown as PermissionsService;
  const svc = new SolicitudesAccesoService(
    solicitudModel as never,
    userModel as never,
    notificador,
    { findDecrypted: () => Promise.resolve(null) } as never,
    email,
    new EscalationService({} as never, permissions),
  );
  return { svc, notificador, userModel };
}

describe('SolicitudesAccesoService — resolución', () => {
  it('aprobar marca aprobada y notifica solicitud_resuelta', async () => {
    const s = solicitudMock();
    const { svc, notificador } = service(s, 'nacion');
    await svc.aprobar(ACTOR, 'id', {});
    expect(s.estado).toBe('aprobada');
    expect(s.nivelAprobado).toBe('grupo');
    expect(notificador.encolar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'solicitud_resuelta' }),
    );
  });

  it('aprobar con cargo que no corresponde al nivel → BadRequest', async () => {
    const { svc } = service(solicitudMock(), 'nacion');
    await expect(
      svc.aprobar(ACTOR, 'id', { nivel: 'region', cargo: 'JEFE DE GRUPO' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolver una solicitud ya resuelta → Conflict', async () => {
    const { svc } = service(
      { ...solicitudMock(), estado: 'aprobada' },
      'nacion',
    );
    await expect(svc.aprobar(ACTOR, 'id', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('solicitud inexistente → NotFound', async () => {
    const { svc } = service(null, 'nacion');
    await expect(svc.rechazar('id', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechazar marca rechazada con la nota', async () => {
    const s = solicitudMock();
    const { svc } = service(s, 'nacion');
    await svc.rechazar('id', { nota: 'no aplica' });
    expect(s.estado).toBe('rechazada');
    expect(s.notaAprobador).toBe('no aplica');
  });
});

describe('SolicitudesAccesoService — no escalada de niveles', () => {
  it('un actor de nivel grupo NO puede aprobar con nivel nacion', async () => {
    const s = solicitudMock();
    const { svc, userModel } = service(s, 'grupo');

    await expect(
      svc.aprobar(ACTOR, 'id', {
        nivel: 'nacion',
        cargo: 'JEFE SCOUT NACIONAL',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(s.estado).toBe('pendiente');
    expect(s.save).not.toHaveBeenCalled();
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });

  it('tampoco aprobando TAL CUAL un nivel que el solicitante pidió alto', async () => {
    // Coherente a propósito: así solo la regla de escalada puede rechazarlo.
    const s = {
      ...solicitudMock(),
      nivelSolicitado: 'nacion',
      cargoSolicitado: 'JEFE SCOUT NACIONAL',
    };
    const { svc, userModel } = service(s, 'grupo');

    await expect(svc.aprobar(ACTOR, 'id', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(userModel.updateOne).not.toHaveBeenCalled();
  });

  it('un actor de nivel nacion SÍ puede aprobar con nivel region', async () => {
    const s = solicitudMock();
    const { svc, userModel } = service(s, 'nacion');

    await svc.aprobar(ACTOR, 'id', {
      nivel: 'region',
      cargo: 'JEFE SCOUT REGIONAL',
    });

    expect(s.estado).toBe('aprobada');
    expect(s.nivelAprobado).toBe('region');
    expect(userModel.updateOne).toHaveBeenCalled();
  });

  it('un actor SIN nivelAcceso no puede aprobar ningún nivel', async () => {
    const { svc, userModel } = service(solicitudMock(), undefined);

    await expect(svc.aprobar(ACTOR, 'id', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(userModel.updateOne).not.toHaveBeenCalled();
  });
});
