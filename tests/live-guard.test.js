import { describe, expect, it } from 'vitest';
import { blockMessage, canTrade, evaluate } from '../src/core/live-guard.js';

const NOW = 1_700_000_000_000;

describe('evaluate', () => {
  it('permite operar con un precio reciente', () => {
    const result = evaluate({ lastPriceAt: NOW - 2000, now: NOW });
    expect(result).toMatchObject({ ok: true, reason: 'fresh', ageMs: 2000 });
  });

  it('bloquea cuando el precio supera la antigüedad máxima', () => {
    const result = evaluate({ lastPriceAt: NOW - 16000, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('stale');
    expect(result.ageMs).toBe(16000);
  });

  it('acepta el límite exacto como fresco', () => {
    expect(evaluate({ lastPriceAt: NOW - 15000, now: NOW }).ok).toBe(true);
  });

  it('bloquea si nunca hubo precio', () => {
    expect(evaluate({ lastPriceAt: null, now: NOW })).toMatchObject({ ok: false, reason: 'no-price', ageMs: null });
    expect(evaluate({ lastPriceAt: undefined, now: NOW }).ok).toBe(false);
  });

  it('trata un reloj desajustado (edad negativa) como fresco', () => {
    expect(evaluate({ lastPriceAt: NOW + 3000, now: NOW })).toMatchObject({ ok: true, ageMs: 0 });
  });

  it('respeta un umbral personalizado', () => {
    expect(evaluate({ lastPriceAt: NOW - 8000, now: NOW, maxAgeMs: 5000 }).ok).toBe(false);
    expect(evaluate({ lastPriceAt: NOW - 8000, now: NOW, maxAgeMs: 10000 }).ok).toBe(true);
  });
});

describe('blockMessage', () => {
  it('explica los segundos de retraso', () => {
    expect(blockMessage({ reason: 'stale', ageMs: 42300 })).toMatch(/42s/);
    expect(blockMessage({ reason: 'stale', ageMs: 42300 })).toMatch(/bloqueada/);
  });

  it('distingue el caso sin precio', () => {
    expect(blockMessage({ reason: 'no-price' })).toMatch(/Sin precio/);
  });
});

describe('canTrade', () => {
  it('resume el estado en un booleano', () => {
    expect(canTrade({ lastPriceAt: NOW, now: NOW })).toBe(true);
    expect(canTrade({ lastPriceAt: NOW - 60000, now: NOW })).toBe(false);
  });
});
