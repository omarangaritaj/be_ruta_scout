import { ProgramEvent } from './program-event.entity';

describe('ProgramEvent.normalizarBloques', () => {
  it('materializa los arreglos ausentes de una fila antigua', () => {
    const evento = new ProgramEvent();
    evento.agenda = undefined as never;
    evento.adultTeam = undefined as never;
    evento.materials = undefined as never;
    evento.participatingUnitIds = undefined as never;
    evento.riskManagement = undefined as never;

    evento.normalizarBloques();

    expect(evento.agenda).toEqual([]);
    expect(evento.adultTeam).toEqual([]);
    expect(evento.materials).toEqual([]);
    expect(evento.participatingUnitIds).toEqual([]);
    expect(evento.riskManagement).toEqual({ checks: [], risks: [] });
  });

  it('respeta los valores existentes', () => {
    const evento = new ProgramEvent();
    evento.agenda = [];
    evento.adultTeam = [];
    evento.materials = [];
    evento.participatingUnitIds = ['unidad-1'];
    evento.riskManagement = { checks: [true, false, null, true], risks: [] };

    evento.normalizarBloques();

    expect(evento.participatingUnitIds).toEqual(['unidad-1']);
    expect(evento.riskManagement.checks).toEqual([true, false, null, true]);
  });

  it('no pierde los riesgos cuando el bloque existe sin arreglo', () => {
    const evento = new ProgramEvent();
    evento.riskManagement = { checks: [true] } as never;

    evento.normalizarBloques();

    expect(evento.riskManagement.risks).toEqual([]);
    expect(evento.riskManagement.checks).toEqual([true]);
  });
});
