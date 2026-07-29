import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateFiles, readManifest } from './domain-codegen';

const MANIFEST = JSON.stringify({
  version: 1,
  branches: [
    {
      name: 'MANADA',
      value: 'manada',
      order: 2,
      siscoutAliases: ['MANADA', 'LOBATO'],
      ageRange: [0, 9],
      growthAreas: ['corporalidad'],
    },
  ],
  accessStates: [{ name: 'APPROVED', value: 'aprobado' }],
  requestStates: [{ name: 'APPROVED', value: 'aprobada' }],
  accessLevels: [{ name: 'SUPER_ADMIN', value: 'super_admin' }],
  roleLevels: [{ name: 'RAMA', value: 'rama' }],
  personTypes: [{ name: 'ADULT', value: 'adulto' }],
  unitRoles: [{ name: 'UNIT_LEADER', value: 'unit_leader' }],
  diagnosticBlocks: [{ name: 'RAP', value: 'rap' }],
  growthAreas: [{ name: 'CORPORALIDAD', value: 'corporalidad' }],
  permissions: [{ key: 'user:read', side: 'both' }],
  routeResources: [
    { path: '/tablero', label: 'Tablero', always: true },
    { path: '/admin/roles', label: 'Roles', section: 'Administración' },
  ],
  apiErrorCodes: [
    { name: 'UNITS_MISSING_GROUP', value: 'UNITS.MISSING_GROUP' },
  ],
});

const vacio = {
  version: 1,
  branches: [],
  accessStates: [],
  requestStates: [],
  accessLevels: [],
  roleLevels: [],
  personTypes: [],
  unitRoles: [],
  diagnosticBlocks: [],
  growthAreas: [],
  permissions: [],
  routeResources: [],
  apiErrorCodes: [],
};

const vacioSerializado = JSON.stringify(vacio);

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

  it('rechaza un manifiesto con rutas duplicadas en routeResources', () => {
    const duplicado = JSON.stringify({
      ...vacio,
      routeResources: [
        { path: '/units', label: 'Unidades' },
        { path: '/units', label: 'Unidades otra vez' },
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
    expect(dictionary).toContain("UNIT_LEADER: 'unit_leader'");
  });

  it('emite UNIT_ROLES y el tipo UnitRole', () => {
    const archivos = generateFiles(readManifest(MANIFEST));
    const roles = archivos.get('src/domain/roles.ts');
    expect(roles).toContain(
      "export const UNIT_ROLES = ['unit_leader'] as const;",
    );
    expect(roles).toContain(
      'export type UnitRole = (typeof UNIT_ROLES)[number];',
    );
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

  it('emite ROUTE_RESOURCES y el tipo RouteResource, fuera del vocabulario prohibido', () => {
    const archivos = generateFiles(readManifest(MANIFEST));
    const routeResources = archivos.get('src/domain/route-resources.ts');
    expect(routeResources).toContain(
      'export interface RouteResource {\n' +
        '  path: string;\n' +
        '  label: string;\n' +
        '  section?: string;\n' +
        '  always?: boolean;\n' +
        '}',
    );
    expect(routeResources).toContain(
      'export const ROUTE_RESOURCES: readonly RouteResource[] = [\n' +
        "  { path: '/tablero', label: 'Tablero', always: true },\n" +
        "  { path: '/admin/roles', label: 'Roles', section: 'Administración' },\n" +
        '];',
    );
    const vocabulario = JSON.parse(
      archivos.get('.domain-vocabulary.json') as string,
    ) as string[];
    expect(vocabulario).not.toContain('/tablero');
    expect(vocabulario).not.toContain('/admin/roles');
  });

  it('ordena las ramas por el campo order', () => {
    const desordenado = JSON.stringify({
      ...vacio,
      growthAreas: [{ name: 'CORPORALIDAD', value: 'corporalidad' }],
      branches: [
        {
          name: 'CLAN',
          value: 'clan',
          order: 5,
          siscoutAliases: [],
          ageRange: [10, 21],
          growthAreas: ['corporalidad'],
        },
        {
          name: 'MANADA',
          value: 'manada',
          order: 2,
          siscoutAliases: [],
          ageRange: [0, 9],
          growthAreas: ['corporalidad'],
        },
      ],
    });
    const archivos = generateFiles(readManifest(desordenado));
    expect(archivos.get('src/domain/branches.ts')).toContain(
      "export const BRANCHES = ['manada', 'clan'] as const;",
    );
  });

  describe('tramos de edad', () => {
    const conRamas = (ramas: Array<Record<string, unknown>>): string =>
      JSON.stringify({ ...vacio, branches: ramas });

    it('emite el mapa de tramos y el resolvedor por edad', () => {
      const archivos = generateFiles(readManifest(MANIFEST));
      const branches = archivos.get('src/domain/branches.ts');
      expect(branches).toContain("{ branch: 'manada', min: 0, max: 9 },");
      expect(branches).toContain('export function branchFromAge(');
    });

    it('rechaza un hueco entre tramos', () => {
      // Un hueco deja al protagonista de esa edad sin rama y sin unidad: es
      // exactamente el fallo que este respaldo viene a cerrar.
      const conHueco = conRamas([
        {
          name: 'A',
          value: 'manada',
          order: 1,
          siscoutAliases: [],
          ageRange: [0, 9],
        },
        {
          name: 'B',
          value: 'tropa',
          order: 2,
          siscoutAliases: [],
          ageRange: [11, 14],
        },
      ]);
      expect(() => readManifest(conHueco)).toThrow(/discontinuo/i);
    });

    it('rechaza un solape entre tramos', () => {
      const conSolape = conRamas([
        {
          name: 'A',
          value: 'manada',
          order: 1,
          siscoutAliases: [],
          ageRange: [0, 9],
        },
        {
          name: 'B',
          value: 'tropa',
          order: 2,
          siscoutAliases: [],
          ageRange: [9, 14],
        },
      ]);
      expect(() => readManifest(conSolape)).toThrow(/discontinuo/i);
    });

    it('rechaza un tramo invertido', () => {
      const invertido = conRamas([
        {
          name: 'A',
          value: 'manada',
          order: 1,
          siscoutAliases: [],
          ageRange: [9, 0],
        },
      ]);
      expect(() => readManifest(invertido)).toThrow(/invertido/i);
    });

    it('rechaza un tramo que no es entero o falta', () => {
      const sinRango = conRamas([
        { name: 'A', value: 'manada', order: 1, siscoutAliases: [] },
      ]);
      expect(() => readManifest(sinRango)).toThrow(/no entero/i);
    });
  });
});

describe('bloques de diagnóstico', () => {
  const manifest = readManifest(
    readFileSync(join(__dirname, '..', 'domain-manifest.json'), 'utf8'),
  );

  it('emite las constantes en src/domain/diagnostic.ts', () => {
    const archivos = generateFiles(manifest);
    expect(archivos.get('src/domain/diagnostic.ts')).toContain(
      "export const DIAGNOSTIC_BLOCKS = ['rap', 'gsat', 'metodo_scout', 'duraslid'] as const;",
    );
  });

  it('los expone en el diccionario D', () => {
    const archivos = generateFiles(manifest);
    expect(archivos.get('src/domain/dictionary.ts')).toContain(
      'DIAGNOSTIC_BLOCK: {',
    );
  });

  it('los suma al vocabulario que bloquea literales sueltos', () => {
    const archivos = generateFiles(manifest);
    const vocabulario = JSON.parse(
      archivos.get('.domain-vocabulary.json') as string,
    ) as string[];
    expect(vocabulario).toContain('duraslid');
  });
});

describe('áreas de crecimiento', () => {
  function manifestCon(branchAreas: string[], growthAreas = ['corporalidad']) {
    return JSON.stringify({
      ...JSON.parse(vacioSerializado),
      growthAreas: growthAreas.map((value) => ({
        name: value.toUpperCase(),
        value,
      })),
      branches: [
        {
          name: 'MANADA',
          value: 'manada',
          order: 2,
          siscoutAliases: ['MANADA'],
          ageRange: [0, 9],
          growthAreas: branchAreas,
        },
      ],
    });
  }

  it('rechaza un área que no existe en el catálogo', () => {
    expect(() => readManifest(manifestCon(['inventada']))).toThrow(
      /inexistente/,
    );
  });

  it('rechaza un área repetida en la misma rama', () => {
    expect(() =>
      readManifest(manifestCon(['corporalidad', 'corporalidad'])),
    ).toThrow(/repetida/);
  });

  it('rechaza una rama sin áreas', () => {
    expect(() => readManifest(manifestCon([]))).toThrow(/sin áreas/);
  });

  it('genera el mapa de rama a áreas', () => {
    const manifest = readManifest(manifestCon(['corporalidad']));
    const archivo = generateFiles(manifest).get('src/domain/growth-areas.ts');

    expect(archivo).toContain("manada: ['corporalidad'],");
    expect(archivo).toContain('export function growthAreasOf(');
  });
});
