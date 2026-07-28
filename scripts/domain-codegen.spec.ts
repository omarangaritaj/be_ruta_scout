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
  requestStates: [{ name: 'APPROVED', value: 'aprobada' }],
  accessLevels: [{ name: 'SUPER_ADMIN', value: 'super_admin' }],
  roleLevels: [{ name: 'RAMA', value: 'rama' }],
  personTypes: [{ name: 'ADULT', value: 'adulto' }],
  unitRoles: [{ name: 'UNIT_LEADER', value: 'unit_leader' }],
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
  permissions: [],
  routeResources: [],
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
