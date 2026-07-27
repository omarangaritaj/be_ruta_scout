import { generateFiles, readManifest } from './domain-codegen';

const MANIFEST = JSON.stringify({
  version: 1,
  branches: [
    {
      name: 'MANADA',
      value: 'manada',
      order: 2,
      siscoutAliases: ['MANADA', 'LOBATO'],
    },
  ],
  accessStates: [{ name: 'APPROVED', value: 'aprobado' }],
  accessLevels: [{ name: 'SUPER_ADMIN', value: 'super_admin' }],
  roleLevels: [{ name: 'RAMA', value: 'rama' }],
  personTypes: [{ name: 'ADULT', value: 'adulto' }],
  permissions: [{ key: 'user:read', side: 'both' }],
  apiErrorCodes: [
    { name: 'UNITS_MISSING_GROUP', value: 'UNITS.MISSING_GROUP' },
  ],
});

const vacio = {
  version: 1,
  branches: [],
  accessStates: [],
  accessLevels: [],
  roleLevels: [],
  personTypes: [],
  permissions: [],
  apiErrorCodes: [],
};

describe('domain codegen', () => {
  it('rechaza un manifiesto con valores duplicados', () => {
    const duplicado = JSON.stringify({
      ...vacio,
      branches: [
        { name: 'A', value: 'manada', order: 1, siscoutAliases: [] },
        { name: 'B', value: 'manada', order: 2, siscoutAliases: [] },
      ],
    });
    expect(() => readManifest(duplicado)).toThrow(/duplicado/i);
  });

  it('emite la constante y el tipo de cada grupo', () => {
    const archivos = generateFiles(readManifest(MANIFEST));
    const branches = archivos.get('src/domain/branches.ts');
    expect(branches).toContain("export const BRANCHES = ['manada'] as const;");
    expect(branches).toContain(
      'export type Branch = (typeof BRANCHES)[number];',
    );
  });

  it('emite el accesor tipado D', () => {
    const archivos = generateFiles(readManifest(MANIFEST));
    const dictionary = archivos.get('src/domain/dictionary.ts');
    expect(dictionary).toContain("MANADA: 'manada'");
    expect(dictionary).toContain("APPROVED: 'aprobado'");
  });

  it('emite el vocabulario prohibido sin permisos ni códigos de error', () => {
    const archivos = generateFiles(readManifest(MANIFEST));
    const vocabulario = JSON.parse(
      archivos.get('.domain-vocabulary.json') as string,
    ) as string[];
    expect(vocabulario).toContain('manada');
    expect(vocabulario).toContain('aprobado');
    expect(vocabulario).not.toContain('user:read');
  });

  it('ordena las ramas por el campo order', () => {
    const desordenado = JSON.stringify({
      ...vacio,
      branches: [
        { name: 'CLAN', value: 'clan', order: 5, siscoutAliases: [] },
        { name: 'MANADA', value: 'manada', order: 2, siscoutAliases: [] },
      ],
    });
    const archivos = generateFiles(readManifest(desordenado));
    expect(archivos.get('src/domain/branches.ts')).toContain(
      "export const BRANCHES = ['manada', 'clan'] as const;",
    );
  });
});
