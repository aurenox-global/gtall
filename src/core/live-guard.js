/**
 * live-guard.js — decide si hay precio suficientemente fresco para operar.
 *
 * Lógica pura (sin DOM ni red) para poder testearla. Los bots la consultan
 * antes de ejecutar cualquier orden: si Binance falla o el último precio tiene
 * más de `maxAgeMs`, la operación se bloquea en vez de usar un precio congelado.
 */

export const DEFAULT_MAX_AGE_MS = 15000;

/**
 * @param {{lastPriceAt: number|null, now?: number, maxAgeMs?: number}} input
 * @returns {{ok: boolean, reason: 'fresh'|'stale'|'no-price', ageMs: number|null}}
 */
export function evaluate({ lastPriceAt = null, now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  if (lastPriceAt === null || lastPriceAt === undefined || !Number.isFinite(Number(lastPriceAt))) {
    return { ok: false, reason: 'no-price', ageMs: null };
  }

  const ageMs = Math.max(0, Number(now) - Number(lastPriceAt));
  if (!Number.isFinite(ageMs)) {
    return { ok: false, reason: 'no-price', ageMs: null };
  }

  if (ageMs > maxAgeMs) {
    return { ok: false, reason: 'stale', ageMs };
  }

  return { ok: true, reason: 'fresh', ageMs };
}

/** Texto para el usuario cuando se bloquea una operación. */
export function blockMessage({ reason, ageMs } = {}) {
  if (reason === 'stale') {
    const seconds = Math.round((Number(ageMs) || 0) / 1000);
    return `⚠️ Precio retrasado (${seconds}s sin actualizar): operación bloqueada.`;
  }
  return '⚠️ Sin precio de Binance todavía: operación bloqueada.';
}

/** Atajo: ¿podemos operar? */
export function canTrade(opts) {
  return evaluate(opts).ok;
}

export const LiveGuard = {
  DEFAULT_MAX_AGE_MS,
  evaluate,
  blockMessage,
  canTrade,
};

if (typeof window !== 'undefined') {
  window.LiveGuard = LiveGuard;
}
