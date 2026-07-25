import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SolicitudesAccesoService } from './solicitudes-acceso.service';

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

function service(solicitud: unknown) {
  const solicitudModel = {
    findById: () => ({ exec: () => Promise.resolve(solicitud) }),
  };
  const userModel = { updateOne: () => ({ exec: () => Promise.resolve({}) }) };
  const notificador = { encolar: jest.fn(() => Promise.resolve()) };
  const svc = new SolicitudesAccesoService(
    solicitudModel as never,
    userModel as never,
    notificador,
    { findDecrypted: () => Promise.resolve(null) } as never,
  );
  return { svc, notificador };
}

describe('SolicitudesAccesoService — resolución', () => {
  it('aprobar marca aprobada y notifica solicitud_resuelta', async () => {
    const s = solicitudMock();
    const { svc, notificador } = service(s);
    await svc.aprobar('id', {});
    expect(s.estado).toBe('aprobada');
    expect(s.nivelAprobado).toBe('grupo');
    expect(notificador.encolar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'solicitud_resuelta' }),
    );
  });

  it('aprobar con cargo que no corresponde al nivel → BadRequest', async () => {
    const { svc } = service(solicitudMock());
    await expect(
      svc.aprobar('id', { nivel: 'region', cargo: 'JEFE DE GRUPO' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolver una solicitud ya resuelta → Conflict', async () => {
    const { svc } = service({ ...solicitudMock(), estado: 'aprobada' });
    await expect(svc.aprobar('id', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('solicitud inexistente → NotFound', async () => {
    const { svc } = service(null);
    await expect(svc.rechazar('id', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechazar marca rechazada con la nota', async () => {
    const s = solicitudMock();
    const { svc } = service(s);
    await svc.rechazar('id', { nota: 'no aplica' });
    expect(s.estado).toBe('rechazada');
    expect(s.notaAprobador).toBe('no aplica');
  });
});
