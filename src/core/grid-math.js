/**
 * grid-math.js — lógica pura de la rejilla (sin DOM, sin red).
 *
 * Implementación de referencia (testeada) de las fórmulas de niveles, reparto
 * de capital, cruces y comisiones. Los tests la importan directamente; los
 * bots conservan de momento su copia inline, pendiente de sustituir por
 * window.GridMath en una siguiente pasada.
 */

export const LIMITS = {
  minGrids: 2,
  maxGrids: 150,
};

/**
 * Construye los niveles de precio de la rejilla.
 * - gridPercent > 0 → progresión geométrica desde minPrice.
 * - gridPercent = 0 → progresión aritmética entre minPrice y maxPrice.
 */
export function computeLevels({ minPrice, maxPrice, gridCount, gridPercent = 0 }) {
  const min = Number(minPrice);
  const max = Number(maxPrice);
  const count = Number(gridCount);
  const pct = Number(gridPercent) || 0;

  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0) {
    throw new Error('Precios de rejilla inválidos');
  }
  if (max <= min) {
    throw new Error('El precio máximo debe ser mayor al mínimo');
  }
  if (!Number.isInteger(count) || count < LIMITS.minGrids) {
    throw new Error(`Mínimo ${LIMITS.minGrids} rejillas`);
  }
  if (count > LIMITS.maxGrids) {
    throw new Error(`Máximo ${LIMITS.maxGrids} rejillas`);
  }
  if (pct < 0) {
    throw new Error('El porcentaje por nivel no puede ser negativo');
  }

  const levels = [];
  if (pct > 0) {
    const ratio = 1 + pct / 100;
    for (let i = 0; i < count; i++) {
      levels.push(min * Math.pow(ratio, i));
    }
  } else {
    const interval = (max - min) / (count - 1);
    for (let i = 0; i < count; i++) {
      levels.push(min + i * interval);
    }
  }
  return levels;
}

/** Distancia entre niveles (aritmética) o % (geométrica). Solo informativo. */
export function describeLevels({ minPrice, maxPrice, gridCount, gridPercent = 0 }) {
  const pct = Number(gridPercent) || 0;
  if (pct > 0) {
    return { mode: 'geometric', gridPercent: pct, label: `${pct.toFixed(2)}% por nivel (geométrico)` };
  }
  const interval = (Number(maxPrice) - Number(minPrice)) / (Number(gridCount) - 1);
  return { mode: 'arithmetic', gridInterval: interval, label: `${interval.toFixed(2)} USDT por nivel` };
}

/**
 * Reparte capital entre órdenes de compra (por debajo de entry) y de venta
 * (por encima), con el mismo modelo que usaba el bot original: el USDT se
 * reparte a partes iguales entre compras y el inventario entre ventas.
 */
export function allocateLevels(levels, { entryPrice, cryptoAllocation, stablecoinAllocation }) {
  const entry = Number(entryPrice);
  if (!Number.isFinite(entry) || entry <= 0) {
    throw new Error('Precio de entrada inválido');
  }
  const buyLevels = levels.filter(p => p < entry);
  const sellLevels = levels.filter(p => p > entry);
  const totalBaseQty = Number(cryptoAllocation) / entry;
  const sellQtyPerOrder = sellLevels.length > 0 ? totalBaseQty / sellLevels.length : 0;
  const buyUsdtPerOrder = buyLevels.length > 0 ? Number(stablecoinAllocation) / buyLevels.length : 0;

  return levels.map(price => {
    if (price < entry) {
      return { price, side: 'buy', qty: buyUsdtPerOrder > 0 ? buyUsdtPerOrder / price : 0 };
    }
    if (price > entry) {
      return { price, side: 'sell', qty: sellQtyPerOrder };
    }
    return { price, side: 'entry', qty: 0 };
  });
}

export function crossedUp(prevPrice, levelPrice, currentPrice) {
  return prevPrice < levelPrice && currentPrice >= levelPrice;
}

export function crossedDown(prevPrice, levelPrice, currentPrice) {
  return prevPrice > levelPrice && currentPrice <= levelPrice;
}

/** Comisión en moneda cotizada para un nocional dado y un % (ej. 0.20). */
export function feeAmount(notional, feePct) {
  const pct = Number(feePct) || 0;
  return Number(notional) * (pct / 100);
}

/**
 * Beneficio neto de un ciclo compra→venta, descontando comisiones.
 * `buyFee`/`sellFee` son importes absolutos, no porcentajes.
 */
export function cycleProfit({ buyPrice, sellPrice, qty, buyFee = 0, sellFee = 0 }) {
  const gross = (Number(sellPrice) - Number(buyPrice)) * Number(qty);
  return gross - Number(buyFee || 0) - Number(sellFee || 0);
}

/** PnL no realizado de una posición larga. */
export function unrealizedPnl({ entryPrice, currentPrice, qty, fee = 0 }) {
  return (Number(currentPrice) - Number(entryPrice)) * Number(qty) - Number(fee || 0);
}

/**
 * ¿Se ha tocado TP o SL? Devuelve 'tp' | 'sl' | null.
 * Los porcentajes son en % (ej. 5 = 5%).
 */
export function hitTakeProfitStopLoss({ entryPrice, currentPrice, tpPercent = 0, slPercent = 0 }) {
  const entry = Number(entryPrice);
  const current = Number(currentPrice);
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(current)) return null;
  const tp = Number(tpPercent) || 0;
  const sl = Number(slPercent) || 0;
  const changePct = ((current - entry) / entry) * 100;
  if (tp > 0 && changePct >= tp) return 'tp';
  if (sl > 0 && changePct <= -sl) return 'sl';
  return null;
}

export const GridMath = {
  LIMITS,
  computeLevels,
  describeLevels,
  allocateLevels,
  crossedUp,
  crossedDown,
  feeAmount,
  cycleProfit,
  unrealizedPnl,
  hitTakeProfitStopLoss,
};

if (typeof window !== 'undefined') {
  window.GridMath = GridMath;
}
