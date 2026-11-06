/**
 * binance.js — cliente de datos públicos de Binance.
 *
 * Solo endpoints públicos (precio, velas, 24h): este proyecto NO firma
 * peticiones ni envía órdenes. El cliente añade lo que faltaba en el monolito:
 *   · caché con TTL por tipo de dato
 *   · deduplicación de peticiones en vuelo
 *   · reintentos con backoff exponencial y respeto de Retry-After
 *   · limitador de ritmo (evita comerse el límite de 1200 req/min)
 *   · estado de conexión observable (online/offline/stale) para la UI
 */

export const TTLS = {
  price: 5000,
  klines: 60000,
  stats24h: 15000,
};

const PATHS = {
  price: '/api/v3/ticker/price',
  klines: '/api/v3/klines',
  stats24h: '/api/v3/ticker/24hr',
};

export class BinanceClient {
  constructor({
    baseUrl = 'https://api.binance.com',
    fetchImpl = (url, options) => globalThis.fetch(url, options),
    now = () => Date.now(),
    wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
    minIntervalMs = 120,
    retries = 3,
    backoffMs = 300,
    staleAfterMs = 30000,
    ttl = TTLS,
  } = {}) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.wait = wait;
    this.minIntervalMs = minIntervalMs;
    this.retries = retries;
    this.backoffMs = backoffMs;
    this.staleAfterMs = staleAfterMs;
    this.ttl = { ...TTLS, ...ttl };
    this.cache = new Map();
    this.inflight = new Map();
    this.listeners = new Set();
    this.lastSuccessAt = null;
    this.lastError = null;
    this.consecutiveFailures = 0;
    this._nextRequestAt = 0;
  }

  get status() {
    const age = this.lastSuccessAt === null ? Infinity : this.now() - this.lastSuccessAt;
    return {
      online: this.consecutiveFailures === 0 && this.lastSuccessAt !== null,
      stale: age > this.staleAfterMs,
      ageMs: Number.isFinite(age) ? age : null,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /** Suscripción al estado de conexión. Devuelve función para desuscribirse. */
  onStatus(listener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /** ¿Tenemos un precio suficientemente reciente para operar? */
  isFresh() {
    const { stale, online } = this.status;
    return online && !stale;
  }

  _emitStatus() {
    const snapshot = this.status;
    for (const fn of this.listeners) {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('[binance] listener de estado falló:', err);
      }
    }
  }

  _setOnline() {
    this.lastSuccessAt = this.now();
    this.consecutiveFailures = 0;
    this.lastError = null;
    this._emitStatus();
  }

  _setOffline(error) {
    this.consecutiveFailures += 1;
    this.lastError = error instanceof Error ? error.message : String(error);
    this._emitStatus();
  }

  async _throttle() {
    const waitMs = this._nextRequestAt - this.now();
    if (waitMs > 0) await this.wait(waitMs);
    this._nextRequestAt = Math.max(this.now(), this._nextRequestAt) + this.minIntervalMs;
  }

  async _fetchJson(url) {
    let lastError = null;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      await this._throttle();
      try {
        const res = await this.fetchImpl(url, { headers: { Accept: 'application/json' } });
        const status = res.status;

        if (status === 429 || status >= 500) {
          const retryAfter = Number(res.headers?.get?.('retry-after'));
          if (attempt === this.retries) throw new Error(`HTTP ${status}`);
          const delay = retryAfter > 0
            ? Math.min(retryAfter * 1000, 10000)
            : this.backoffMs * 2 ** attempt;
          await this.wait(delay);
          continue;
        }

        if (!res.ok) {
          // 4xx de cliente (símbolo inválido, etc.): reintentar no sirve.
          throw Object.assign(new Error(`HTTP ${status}`), { fatal: true });
        }

        const json = await res.json();
        this._setOnline();
        return json;
      } catch (err) {
        lastError = err;
        if (err && err.fatal) break;
        if (attempt === this.retries) break;
        await this.wait(this.backoffMs * 2 ** attempt);
      }
    }
    this._setOffline(lastError);
    throw lastError || new Error('Fallo desconocido en Binance');
  }

  async _get(path, params, kind) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`;
    const key = `${path}?${query}`;
    const ttl = this.ttl[kind] ?? 0;

    const cached = this.cache.get(key);
    if (cached && ttl > 0 && this.now() - cached.at < ttl) {
      return cached.value;
    }

    if (this.inflight.has(key)) return this.inflight.get(key);

    const promise = this._fetchJson(url)
      .then(value => {
        if (ttl > 0) this.cache.set(key, { at: this.now(), value });
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Precio actual. Devuelve null si no se pudo obtener (nunca lanza). */
  async price(symbol) {
    try {
      const data = await this._get(PATHS.price, { symbol }, 'price');
      const value = Number(data?.price);
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch (err) {
      return null;
    }
  }

  /** Velas: [[openTime, open, high, low, close, volume, closeTime, ...], ...] */
  async klines({ symbol, interval, startTime, endTime, limit = 500 }) {
    try {
      const data = await this._get(
        PATHS.klines,
        { symbol, interval, startTime, endTime, limit },
        'klines'
      );
      return Array.isArray(data) ? data : null;
    } catch (err) {
      return null;
    }
  }

  /** Estadísticas 24h (cruda: lastPrice, priceChangePercent, ...). */
  async stats24h(symbol) {
    try {
      return await this._get(PATHS.stats24h, { symbol }, 'stats24h');
    } catch (err) {
      return null;
    }
  }

  /**
   * Shim compatible con fetch() para las llamadas heredadas del monolito.
   * Devuelve un objeto con .json() como una Response, pero con caché,
   * deduplicación, limitador de ritmo y reintentos por debajo.
   */
  async fetch(url) {
    let parsed;
    try {
      parsed = new URL(url, typeof location !== 'undefined' ? location.href : this.baseUrl);
    } catch (err) {
      throw new TypeError(`URL inválida: ${url}`);
    }

    const kind = parsed.pathname.includes('/klines')
      ? 'klines'
      : parsed.pathname.includes('/24hr')
        ? 'stats24h'
        : 'price';
    const params = Object.fromEntries(parsed.searchParams.entries());
    const data = await this._get(parsed.pathname, params, kind);

    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => data,
      text: async () => JSON.stringify(data),
    };
  }

  clearCache() {
    this.cache.clear();
  }
}

export const BinanceAPI = new BinanceClient();

if (typeof window !== 'undefined') {
  window.BinanceAPI = BinanceAPI;
  window.BinanceClient = BinanceClient;
}
