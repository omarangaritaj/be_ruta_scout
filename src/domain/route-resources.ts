// GENERADO por `pnpm domain:gen` desde domain-manifest.json. No editar a mano.

export interface RouteResource {
  path: string;
  label: string;
  section?: string;
  always?: boolean;
}

export const ROUTE_RESOURCES: readonly RouteResource[] = [
  { path: '/tablero', label: 'Tablero', always: true },
  { path: '/units', label: 'Unidades' },
  { path: '/aprobaciones', label: 'Aprobaciones', section: 'Administración' },
  { path: '/admin/usuarios', label: 'Usuarios', section: 'Administración' },
  { path: '/admin/roles', label: 'Roles', section: 'Administración' },
];
