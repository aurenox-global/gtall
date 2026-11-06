import { describe, expect, it } from 'vitest';
import {
  allocateLevels,
  computeLevels,
  crossedDown,
  crossedUp,
  cycleProfit,
  describeLevels,
  feeAmount,
  hitTakeProfitStopLoss,
  realizeExit,
  unrealizedPnl,
} from '../src/core/grid-math.js';

describe('computeLevels', () => {
  it('reparte niveles aritméticos entre mínimo y máximo', () => {
    const levels = computeLevels({ minPrice: 100, maxPrice: 200, gridCount: 11 });
    expect(levels).toHaveLength(11);
    expect(levels[0]).toBeCloseTo(100);
    expect(levels[5]).toBeCloseTo(150);
    expect(levels[10]).toBeCloseTo(200);
    // espaciado constante
    expect(levels[1] - levels[0]).toBeCloseTo(levels[10] - levels[9]);
  });

  it('usa progresión geométrica cuando hay porcentaje por nivel', () => {
    const levels = computeLevels({ minPrice: 100, maxPrice: 1000, gridCount: 3, gridPercent: 10 });
    expect(levels[0]).toBeCloseTo(100);
    expect(levels[1]).toBeCloseTo(110);
    expect(levels[2]).toBeCloseTo(121);
  });

  it('rechaza rangos y conteos inválidos', () => {
    expect(() => computeLevels({ minPrice: 200, maxPrice: 100, gridCount: 10 })).toThrow(/mayor al mínimo/);
    expect(() => computeLevels({ minPrice: 100, maxPrice: 200, gridCount: 1 })).toThrow(/Mínimo 2/);
    expect(() => computeLevels({ minPrice: 100, maxPrice: 200, gridCount: 151 })).toThrow(/Máximo 150/);
    expect(() => computeLevels({ minPrice: 0, maxPrice: 200, gridCount: 10 })).toThrow(/inválidos/);
  });

  it('describe el modo y el tamaño de rejilla', () => {
    expect(describeLevels({ minPrice: 100, maxPrice: 200, gridCount: 11 })).toMatchObject({
      mode: 'arithmetic',
      gridInterval: 10,
    });
    expect(describeLevels({ minPrice: 100, maxPrice: 200, gridCount: 11, gridPercent: 2 })).toMatchObject({
      mode: 'geometric',
      gridPercent: 2,
    });
  });
});

describe('allocateLevels', () => {
  it('reparte USDT entre compras e inventario entre ventas', () => {
    const levels = [100, 150, 200];
    const orders = allocateLevels(levels, {
      entryPrice: 150,
      cryptoAllocation: 150,
      stablecoinAllocation: 100,
    });

    expect(orders.map(o => o.side)).toEqual(['buy', 'entry', 'sell']);
    // 100 USDT para una sola compra a 100 → 1 unidad
    expect(orders[0].qty).toBeCloseTo(1);
    // inventario total 150/150 = 1 unidad, una sola venta
    expect(orders[2].qty).toBeCloseTo(1);
    expect(orders[1].qty).toBe(0);
  });

  it('rechaza precios de entrada inválidos', () => {
    expect(() => allocateLevels([100], { entryPrice: 0, cryptoAllocation: 1, stablecoinAllocation: 1 })).toThrow();
  });
});

describe('cruces de niveles', () => {
  it('detecta cruce al alza incluyendo el toque exacto', () => {
    expect(crossedUp(99, 100, 101)).toBe(true);
    expect(crossedUp(99, 100, 100)).toBe(true);
    expect(crossedUp(100, 100, 101)).toBe(false);
    expect(crossedUp(101, 100, 102)).toBe(false);
  });

  it('detecta cruce a la baja incluyendo el toque exacto', () => {
    expect(crossedDown(101, 100, 99)).toBe(true);
    expect(crossedDown(101, 100, 100)).toBe(true);
    expect(crossedDown(100, 100, 99)).toBe(false);
  });
});

describe('comisiones y PnL', () => {
  it('calcula la comisión sobre el nocional', () => {
    expect(feeAmount(1000, 0.2)).toBeCloseTo(2);
    expect(feeAmount(1000, 0)).toBe(0);
  });

  it('descuenta comisiones del beneficio del ciclo', () => {
    const profit = cycleProfit({ buyPrice: 100, sellPrice: 110, qty: 1, buyFee: 0.2, sellFee: 0.22 });
    expect(profit).toBeCloseTo(9.58);
  });

  it('calcula PnL no realizado', () => {
    expect(unrealizedPnl({ entryPrice: 100, currentPrice: 105, qty: 2, fee: 1 })).toBeCloseTo(9);
  });
});

describe('realizeExit', () => {
  it('calcula la salida descontando comisión y coste real', () => {
    const exit = realizeExit({ qty: 2, price: 110, feePct: 0.2, costBasis: 200 });
    expect(exit.gross).toBeCloseTo(220);
    expect(exit.fee).toBeCloseTo(0.44);
    expect(exit.proceeds).toBeCloseTo(219.56);
    expect(exit.pnl).toBeCloseTo(19.56);
  });

  it('puede dar pérdida (stop loss)', () => {
    const exit = realizeExit({ qty: 1, price: 90, feePct: 0.2, costBasis: 100 });
    expect(exit.pnl).toBeCloseTo(-10.18);
  });

  it('sin inventario devuelve una salida vacía', () => {
    const exit = realizeExit({ qty: 0, price: 100, costBasis: 0 });
    expect(exit.proceeds).toBe(0);
    expect(exit.pnl).toBe(0);
  });
});

describe('take profit / stop loss', () => {
  it('dispara TP al alcanzar el umbral exacto', () => {
    expect(hitTakeProfitStopLoss({ entryPrice: 100, currentPrice: 105, tpPercent: 5 })).toBe('tp');
    expect(hitTakeProfitStopLoss({ entryPrice: 100, currentPrice: 104.99, tpPercent: 5 })).toBeNull();
  });

  it('dispara SL al alcanzar el umbral exacto', () => {
    expect(hitTakeProfitStopLoss({ entryPrice: 100, currentPrice: 95, slPercent: 5 })).toBe('sl');
    expect(hitTakeProfitStopLoss({ entryPrice: 100, currentPrice: 95.01, slPercent: 5 })).toBeNull();
  });

  it('no dispara nada sin umbrales configurados', () => {
    expect(hitTakeProfitStopLoss({ entryPrice: 100, currentPrice: 200 })).toBeNull();
  });
});
