/**
 * Indicadores técnicos (SMA, EMA, RSI, MACD, Bollinger).
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class TechnicalIndicators {
    static calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;
        
        let gains = [];
        let losses = [];
        
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        
        const avgGain = gains.slice(-period).reduce((a, b) => a + b) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b) / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    static calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (prices.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };
        
        const fastEMA = this.calculateEMA(prices, fastPeriod);
        const slowEMA = this.calculateEMA(prices, slowPeriod);
        const macd = fastEMA - slowEMA;
        
        // Simplified signal calculation
        const signal = macd * 0.9; // Simplified for demo
        const histogram = macd - signal;
        
        return { macd, signal, histogram };
    }

    static calculateEMA(prices, period) {
        if (prices.length === 0) return 0;
        
        const multiplier = 2 / (period + 1);
        let ema = prices[0];
        
        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        
        return ema;
    }

    static calculateBollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
        
        const recentPrices = prices.slice(-period);
        const sma = recentPrices.reduce((a, b) => a + b) / period;
        
        const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);
        
        return {
            upper: sma + (standardDeviation * stdDev),
            middle: sma,
            lower: sma - (standardDeviation * stdDev)
        };
    }

    static updateIndicators(symbol, currentPrice, priceHistory) {
        const prices = priceHistory.map(item => item.price);
        
        // RSI
        const rsi = this.calculateRSI(prices);
        const rsiElement = document.getElementById(`rsi-${symbol}`);
        if (rsiElement) {
            rsiElement.textContent = rsi.toFixed(1);
            rsiElement.className = `indicator-value ${rsi > 70 ? 'indicator-bearish' : rsi < 30 ? 'indicator-bullish' : 'indicator-neutral'}`;
        }

        // MACD
        const macd = this.calculateMACD(prices);
        const macdElement = document.getElementById(`macd-${symbol}`);
        if (macdElement) {
            macdElement.textContent = macd.macd.toFixed(2);
            macdElement.className = `indicator-value ${macd.macd > 0 ? 'indicator-bullish' : 'indicator-bearish'}`;
        }

        // Bollinger Bands
        const bb = this.calculateBollingerBands(prices);
        const bbElement = document.getElementById(`bb-${symbol}`);
        if (bbElement) {
            const position = currentPrice > bb.upper ? 'Overbought' : currentPrice < bb.lower ? 'Oversold' : 'Normal';
            bbElement.textContent = position;
            bbElement.className = `indicator-value ${position === 'Oversold' ? 'indicator-bullish' : position === 'Overbought' ? 'indicator-bearish' : 'indicator-neutral'}`;
        }

        // EMA 20
        const ema20 = this.calculateEMA(prices, 20);
        const ema20Element = document.getElementById(`ema20-${symbol}`);
        if (ema20Element) {
            ema20Element.textContent = ema20.toFixed(2);
            ema20Element.className = `indicator-value ${currentPrice > ema20 ? 'indicator-bullish' : 'indicator-bearish'}`;
        }

        // Volume (simulated)
        const volumeElement = document.getElementById(`volume-${symbol}`);
        if (volumeElement) {
            const trend = Math.random() > 0.5 ? 'High' : 'Normal';
            volumeElement.textContent = trend;
            volumeElement.className = `indicator-value ${trend === 'High' ? 'indicator-bullish' : 'indicator-neutral'}`;
        }
    }
}
