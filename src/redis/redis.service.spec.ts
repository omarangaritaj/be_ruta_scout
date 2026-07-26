import { RedisService } from './redis.service';

function makeClient(overrides: Record<string, jest.Mock> = {}) {
  return {
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve('OK')),
    del: jest.fn(() => Promise.resolve(1)),
    exists: jest.fn(() => Promise.resolve(1)),
    quit: jest.fn(() => Promise.resolve('OK')),
    disconnect: jest.fn(),
    ...overrides,
  };
}

function makeService(opts: { client?: unknown; ttl?: number } = {}) {
  const client = opts.client ?? makeClient();
  const settings = {
    get: () => ({ defaultCacheTtlSeconds: opts.ttl ?? 300 }),
  };
  const svc = new RedisService(client as never, settings as never);
  return { svc, client: client as ReturnType<typeof makeClient> };
}

describe('RedisService', () => {
  describe('set: serializa y aplica TTL', () => {
    it('serializa a JSON y usa el TTL por defecto de la configuración', async () => {
      const { svc, client } = makeService({ ttl: 120 });
      await svc.set('perfil:1', { id: 1, roles: ['admin'], activo: true });
      expect(client.set).toHaveBeenCalledWith(
        'perfil:1',
        '{"id":1,"roles":["admin"],"activo":true}',
        'EX',
        120,
      );
    });

    it('un ttlSeconds explícito sobrescribe el por defecto', async () => {
      const { svc, client } = makeService({ ttl: 300 });
      await svc.set('k', 'hola', 30);
      expect(client.set).toHaveBeenCalledWith('k', '"hola"', 'EX', 30);
    });

    it('ttl <= 0 guarda sin expiración', async () => {
      const { svc, client } = makeService();
      await svc.set('k', 42, 0);
      expect(client.set).toHaveBeenCalledWith('k', '42');
    });

    it('no guarda undefined', async () => {
      const { svc, client } = makeService();
      await svc.set('k', undefined);
      expect(client.set).not.toHaveBeenCalled();
    });
  });

  describe('get: deserializa al tipo adecuado', () => {
    it.each([
      ['string', '"hola"', 'hola'],
      ['number', '42', 42],
      ['boolean', 'true', true],
      ['array', '[1,2,3]', [1, 2, 3]],
      ['objeto', '{"a":1,"b":{"c":2}}', { a: 1, b: { c: 2 } }],
      ['null', 'null', null],
    ])('deserializa %s', async (_tipo, raw, esperado) => {
      const client = makeClient({ get: jest.fn(() => Promise.resolve(raw)) });
      const { svc } = makeService({ client });
      await expect(svc.get('k')).resolves.toEqual(esperado);
    });

    it('devuelve null cuando la clave no existe', async () => {
      const client = makeClient({ get: jest.fn(() => Promise.resolve(null)) });
      const { svc } = makeService({ client });
      await expect(svc.get('k')).resolves.toBeNull();
    });
  });

  describe('degradación con gracia (Redis caído)', () => {
    it('get devuelve null si el cliente lanza', async () => {
      const client = makeClient({
        get: jest.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
      });
      const { svc } = makeService({ client });
      await expect(svc.get('k')).resolves.toBeNull();
    });

    it('set no lanza si el cliente lanza', async () => {
      const client = makeClient({
        set: jest.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
      });
      const { svc } = makeService({ client });
      await expect(svc.set('k', 1)).resolves.toBeUndefined();
    });

    it('has devuelve false si el cliente lanza', async () => {
      const client = makeClient({
        exists: jest.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
      });
      const { svc } = makeService({ client });
      await expect(svc.has('k')).resolves.toBe(false);
    });
  });

  describe('getOrSet: lee-o-computa', () => {
    it('devuelve el valor cacheado sin invocar factory (hit)', async () => {
      const client = makeClient({
        get: jest.fn(() => Promise.resolve('"cacheado"')),
      });
      const { svc } = makeService({ client });
      const factory = jest.fn(() => Promise.resolve('fresco'));
      await expect(svc.getOrSet('k', factory)).resolves.toBe('cacheado');
      expect(factory).not.toHaveBeenCalled();
    });

    it('computa, cachea y devuelve en miss', async () => {
      const client = makeClient({ get: jest.fn(() => Promise.resolve(null)) });
      const { svc } = makeService({ client, ttl: 60 });
      const factory = jest.fn(() => Promise.resolve({ fresco: true }));
      await expect(svc.getOrSet('k', factory)).resolves.toEqual({
        fresco: true,
      });
      expect(factory).toHaveBeenCalledTimes(1);
      expect(client.set).toHaveBeenCalledWith('k', '{"fresco":true}', 'EX', 60);
    });
  });

  describe('del', () => {
    it('borra varias claves de una vez', async () => {
      const { svc, client } = makeService();
      await svc.del('a', 'b', 'c');
      expect(client.del).toHaveBeenCalledWith('a', 'b', 'c');
    });

    it('no llama al cliente sin claves', async () => {
      const { svc, client } = makeService();
      await svc.del();
      expect(client.del).not.toHaveBeenCalled();
    });
  });
});
