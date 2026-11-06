import { describe, expect, it } from 'vitest';
import { BinanceClient } from '../src/core/binance.js';

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  };
}

function makeClient(overrides = {}) {
  let current = 0;
  const waits = [];
  const calls = [];
  const client = new BinanceClient({
    fetchImpl: async url => {
      calls.push(url);
      return jsonResponse({ price: '100.5' });
    },
    now: () => current,
    wait: async ms => {
      waits.push(ms);
    },
    minIntervalMs: 0,
    backoffMs: 10,
    staleAfterMs: 30000,
    ...overrides,
  });
  return { client, calls, waits, advance: ms => { current += ms; } };
}

describe('BinanceClient', () => {
  it('cachea el precio durante el TTL', async () => {
    const { client, calls, advance } = makeClient();
    expect(await client.price('BTCUSDT')).toBeCloseTo(100.5);
    expect(await client.price('BTCUSDT')).toBeCloseTo(100.5);
    expect(calls).toHaveLength(1);

    advance(6000); // TTL de precio = 5s
    expect(await client.price('BTCUSDT')).toBeCloseTo(100.5);
    expect(calls).toHaveLength(2);
  });

  it('deduplica peticiones concurrentes idénticas', async () => {
    const { client, calls } = makeClient();
    const [a, b] = await Promise.all([client.price('ETHUSDT'), client.price('ETHUSDT')]);
    expect(a).toBeCloseTo(100.5);
    expect(b).toBeCloseTo(100.5);
    expect(calls).toHaveLength(1);
  });

  it('reintenta y acaba devolviendo el precio', async () => {
    let attempt = 0;
    const client = new BinanceClient({
      fetchImpl: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('ECONNRESET');
        return jsonResponse({ price: '42' });
      },
      now: () => 0,
      wait: async () => {},
      minIntervalMs: 0,
      retries: 2,
    });

    expect(await client.price('BTCUSDT')).toBe(42);
    expect(attempt).toBe(2);
    expect(client.status.online).toBe(true);
  });

  it('respeta Retry-After en 429 y termina bien', async () => {
    let attempt = 0;
    const waits = [];
    const client = new BinanceClient({
      fetchImpl: async () => {
        attempt += 1;
        if (attempt === 1) {
          return jsonResponse({ msg: 'rate limit' }, { status: 429, headers: { 'retry-after': '2' } });
        }
        return jsonResponse({ price: '7' });
      },
      now: () => 0,
      wait: async ms => waits.push(ms),
      minIntervalMs: 0,
      retries: 2,
    });

    expect(await client.price('BTCUSDT')).toBe(7);
    expect(waits).toContain(2000);
  });

  it('no reintenta errores fatales 4xx', async () => {
    let attempt = 0;
    const client = new BinanceClient({
      fetchImpl: async () => {
        attempt += 1;
        return jsonResponse({ msg: 'Invalid symbol.' }, { status: 400 });
      },
      now: () => 0,
      wait: async () => {},
      minIntervalMs: 0,
      retries: 3,
    });

    expect(await client.price('NOPE')).toBeNull();
    expect(attempt).toBe(1);
    expect(client.status.online).toBe(false);
    expect(client.status.lastError).toMatch(/400/);
  });

  it('marca los datos como stale pasado el umbral', async () => {
    const { client, advance } = makeClient();
    await client.price('BTCUSDT');
    expect(client.isFresh()).toBe(true);

    advance(31000);
    expect(client.status.stale).toBe(true);
    expect(client.isFresh()).toBe(false);
  });

  it('devuelve velas y estadísticas 24h', async () => {
    const klines = [[1, '100', '110', '90', '105', '10', 2]];
    const client = new BinanceClient({
      fetchImpl: async url => {
        if (url.includes('/klines')) return jsonResponse(klines);
        return jsonResponse({ volume: '1234', priceChangePercent: '1.5' });
      },
      now: () => 0,
      wait: async () => {},
      minIntervalMs: 0,
    });

    expect(await client.klines({ symbol: 'BTCUSDT', interval: '1h', limit: 1 })).toEqual(klines);
    expect(await client.stats24h('BTCUSDT')).toMatchObject({ volume: '1234' });
  });

  it('el shim de fetch mantiene la forma de Response', async () => {
    const { client } = makeClient();
    const res = await client.fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ price: '100.5' });
  });
});
