/**
 * status-badge.js — pinta el estado real de la conexión con Binance.
 *
 * Sustituye a los badges estáticos ("Binance API: Conectado") que mentían:
 * aquí el texto y el color dependen de las peticiones reales.
 */

import { BinanceAPI } from './binance.js';

const LABELS = {
  connecting: '🔌 Precios: conectando…',
  online: '🟢 Precios en vivo',
  stale: '🟡 Datos retrasados',
  offline: '🔴 Sin conexión',
};

export function connectStatusBadge({ badgeId = 'connectionStatus', detailId = 'connectionDetail' } = {}) {
  const badge = document.getElementById(badgeId);
  const detail = document.getElementById(detailId);
  if (!badge) return () => {};

  const render = status => {
    let state = 'online';
    if (!status.online && (status.consecutiveFailures > 0 || status.lastError)) {
      state = 'offline';
    } else if (!status.lastSuccessAt) {
      state = 'connecting';
    } else if (status.stale) {
      state = 'stale';
    }

    badge.textContent = LABELS[state];
    badge.dataset.state = state;
    badge.title = status.lastError ? `Último error: ${status.lastError}` : 'Datos públicos de Binance';

    if (detail) {
      if (state === 'online') {
        detail.textContent = `actualizado ${Math.round((status.ageMs || 0) / 1000)}s atrás`;
      } else if (state === 'stale') {
        detail.textContent = `último dato hace ${Math.round((status.ageMs || 0) / 1000)}s`;
      } else if (state === 'offline') {
        detail.textContent = status.lastError || 'reintentando…';
      } else {
        detail.textContent = 'consultando API pública';
      }
    }
  };

  const unsubscribe = BinanceAPI.onStatus(render);
  const tick = setInterval(() => render(BinanceAPI.status), 5000);
  return () => {
    unsubscribe();
    clearInterval(tick);
  };
}
