import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { AppForbiddenException } from '../common';
import { Role } from '../roles/schemas/role.schema';
import { EscalationService } from './escalation.service';
import { PermissionsService } from './permissions.service';

const ROLE_A = '507f1f77bcf86cd799439011';
const ROLE_B = '507f1f77bcf86cd799439012';

describe('EscalationService', () => {
  let service: EscalationService;
  let roleModel: { find: jest.Mock };
  let permissions: {
    effectivePermissions: jest.Mock;
    effectiveResources: jest.Mock;
  };
  let rolesInDb: { permissions: string[]; resources: string[] }[];

  beforeEach(async () => {
    rolesInDb = [];
    roleModel = {
      find: jest.fn(() => ({ exec: () => Promise.resolve(rolesInDb) })),
    };
    permissions = {
      effectivePermissions: jest.fn(() => Promise.resolve(new Set<string>())),
      effectiveResources: jest.fn(() => Promise.resolve(new Set<string>())),
    };

    const module = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: PermissionsService, useValue: permissions },
      ],
    }).compile();

    service = module.get(EscalationService);
  });

  describe('grantsOfRoles', () => {
    it('une los permisos y las rutas de todos los roles pedidos', async () => {
      rolesInDb = [
        { permissions: ['unit:read'], resources: ['/units'] },
        {
          permissions: ['unit:read', 'role:read'],
          resources: ['/admin/roles'],
        },
      ];

      await expect(service.grantsOfRoles([ROLE_A, ROLE_B])).resolves.toEqual({
        permissions: ['unit:read', 'role:read'],
        resources: ['/units', '/admin/roles'],
      });
    });

    it('NO filtra por status: un rol inactivo también cuenta', async () => {
      await service.grantsOfRoles([ROLE_A]);

      const [filter] = roleModel.find.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(filter).toEqual({ _id: { $in: [ROLE_A] } });
      expect(filter).not.toHaveProperty('status');
    });

    it('sin roles no consulta la base', async () => {
      await expect(service.grantsOfRoles([])).resolves.toEqual({});
      expect(roleModel.find).not.toHaveBeenCalled();
    });
  });

  describe('assertCanGrant', () => {
    it('sin nada que conceder ni pregunta por los poderes del actor', async () => {
      await service.assertCanGrant('actor', {
        permissions: [],
        resources: [],
      });

      expect(permissions.effectivePermissions).not.toHaveBeenCalled();
      expect(permissions.effectiveResources).not.toHaveBeenCalled();
    });

    it('acumula lo que falta de permisos Y de rutas en un solo mensaje', async () => {
      await expect(
        service.assertCanGrant('actor', {
          permissions: ['*'],
          resources: ['/units'],
        }),
      ).rejects.toThrow(/\*, \/units/);
    });

    it('el rechazo es un 403', async () => {
      await expect(
        service.assertCanGrant('actor', { permissions: ['*'] }),
      ).rejects.toBeInstanceOf(AppForbiddenException);
    });
  });

  describe('assertCanGrantRoles', () => {
    it('no consulta nada cuando la lista de roles no cambia', async () => {
      await service.assertCanGrantRoles('actor', [ROLE_A], [ROLE_A]);

      expect(roleModel.find).not.toHaveBeenCalled();
    });

    it('solo mira los roles añadidos, no los que se quedan', async () => {
      rolesInDb = [{ permissions: [], resources: [] }];

      await service.assertCanGrantRoles('actor', [ROLE_A], [ROLE_A, ROLE_B]);

      expect(roleModel.find).toHaveBeenCalledWith(
        { _id: { $in: [ROLE_B] } },
        'permissions resources',
      );
    });
  });
});
