import { buildSeedOperations } from './growth-items-operations';

const CATALOG = [
  { branch: 'tropa', growthArea: 'afectividad', order: 1, text: 'Uno' },
];

describe('buildSeedOperations', () => {
  it('filtra por la clave única de la colección', () => {
    const [operation] = buildSeedOperations(CATALOG);

    expect(operation.updateOne.filter).toEqual({
      branch: 'tropa',
      growthArea: 'afectividad',
      order: 1,
    });
  });

  it('inserta pero nunca actualiza lo que ya existe', () => {
    const [operation] = buildSeedOperations(CATALOG);

    expect(operation.updateOne.upsert).toBe(true);
    expect(operation.updateOne.update).toEqual({
      $setOnInsert: { text: 'Uno', isActive: true },
    });
    expect(operation.updateOne.update).not.toHaveProperty('$set');
  });

  it('produce una operación por item', () => {
    expect(buildSeedOperations(CATALOG)).toHaveLength(1);
  });
});
