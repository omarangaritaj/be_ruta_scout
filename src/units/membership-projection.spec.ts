import { projectMemberships } from './membership-projection';

const unit = {
  _id: 'u1',
  groupId: 304,
  unitLeaderId: 'a1',
  leaders: ['a2', 'a3'],
  members: ['p1', 'p2'],
};

describe('projectMemberships', () => {
  it('produce una fila por persona con su rol', () => {
    expect(projectMemberships(unit)).toEqual([
      { userId: 'a1', unitId: 'u1', role: 'unit_leader', groupId: 304 },
      { userId: 'a2', unitId: 'u1', role: 'assistant', groupId: 304 },
      { userId: 'a3', unitId: 'u1', role: 'assistant', groupId: 304 },
      { userId: 'p1', unitId: 'u1', role: 'member', groupId: 304 },
      { userId: 'p2', unitId: 'u1', role: 'member', groupId: 304 },
    ]);
  });

  it('el jefe gana si tambien aparece como subjefe', () => {
    const rows = projectMemberships({ ...unit, leaders: ['a1', 'a2'] });
    expect(rows.filter((r) => r.userId === 'a1')).toEqual([
      { userId: 'a1', unitId: 'u1', role: 'unit_leader', groupId: 304 },
    ]);
  });

  it('una unidad sin subjefes solo proyecta jefe y miembros', () => {
    expect(projectMemberships({ ...unit, leaders: [] })).toHaveLength(3);
  });
});
