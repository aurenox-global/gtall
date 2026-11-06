/**
 * Sistema de alertas de precio/indicadores.
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class AlertsSystem {
    constructor() {
        this.alerts = [];
        this.activeCount = 2;
        this.triggeredToday = 5;
        this.totalCount = 24;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.updateDisplay();
        this.startPriceMonitoring();
    }

    setupEventListeners() {
        const createBtn = document.getElementById('createAlert');
        const testBtn = document.getElementById('testAlert');
        
        if (createBtn) createBtn.addEventListener('click', () => this.createAlert());
        if (testBtn) testBtn.addEventListener('click', () => this.testAlert());
        
        // Agregar event listeners para los botones de tipo de alerta
        const alertTypeBtns = document.querySelectorAll('[data-alert]');
        alertTypeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remover active de todos los botones
                alertTypeBtns.forEach(b => b.classList.remove('active'));
                // Agregar active al botón clickeado
                e.target.classList.add('active');
                // Mostrar formulario correspondiente
                this.showAlertForm(e.target.dataset.alert);
            });
        });
    }

    showAlertForm(alertType) {
        // Ocultar todos los formularios
        const forms = ['price-alert-form', 'indicator-alert-form', 'volume-alert-form'];
        forms.forEach(formId => {
            const form = document.getElementById(formId);
            if (form) form.style.display = 'none';
        });
        
        // Mostrar el formulario correspondiente
        const targetForm = document.getElementById(`${alertType}-alert-form`);
        if (targetForm) {
            targetForm.style.display = 'block';
        }
    }

    createAlert() {
        // Obtener el tipo de alerta activo
        const activeTypeBtn = document.querySelector('[data-alert].active');
        if (!activeTypeBtn) {
            this.showMessage('Error: No se pudo determinar el tipo de alerta', 'error');
            return;
        }
        
        const alertType = activeTypeBtn.dataset.alert;
        const symbolElement = document.getElementById('alert-symbol');
        const messageElement = document.getElementById('alert-message');
        
        if (!symbolElement) {
            console.error('Symbol element not found');
            return;
        }
        
        const symbol = symbolElement.value;
        const message = messageElement ? messageElement.value : '';

        let alertData = {
            id: Date.now(),
            symbol: symbol,
            type: alertType,
            message: message,
            created: new Date(),
            triggered: false
        };

        // Configurar datos según el tipo de alerta
        if (alertType === 'price') {
            const conditionElement = document.getElementById('alert-condition');
            const valueElement = document.getElementById('alert-value');
            
            if (!conditionElement || !valueElement) {
                this.showMessage('Por favor completa todos los campos de precio', 'error');
                return;
            }
            
            const value = parseFloat(valueElement.value);
            if (!value || value <= 0) {
                this.showMessage('Por favor ingresa un valor de precio válido', 'error');
                return;
            }
            
            alertData.condition = conditionElement.value;
            alertData.value = value;
            
        } else if (alertType === 'indicator') {
            const indicatorElement = document.getElementById('alert-indicator');
            const periodElement = document.getElementById('alert-indicator-period');
            const conditionElement = document.getElementById('alert-indicator-condition');
            const valueElement = document.getElementById('alert-indicator-value');
            
            if (!indicatorElement || !periodElement || !conditionElement || !valueElement) {
                this.showMessage('Por favor completa todos los campos del indicador', 'error');
                return;
            }
            
            const value = parseFloat(valueElement.value);
            const period = parseInt(periodElement.value);
            
            if (!value || isNaN(value)) {
                this.showMessage('Por favor ingresa un valor de indicador válido', 'error');
                return;
            }
            
            if (!period || period < 1) {
                this.showMessage('Por favor ingresa un período válido', 'error');
                return;
            }
            
            alertData.indicator = indicatorElement.value;
            alertData.period = period;
            alertData.condition = conditionElement.value;
            alertData.value = value;
            
        } else if (alertType === 'volume') {
            const conditionElement = document.getElementById('alert-volume-condition');
            const valueElement = document.getElementById('alert-volume-value');
            const timeframeElement = document.getElementById('alert-volume-timeframe');
            
            if (!conditionElement || !valueElement || !timeframeElement) {
                this.showMessage('Por favor completa todos los campos de volumen', 'error');
                return;
            }
            
            const value = parseFloat(valueElement.value);
            if (!value || value <= 0) {
                this.showMessage('Por favor ingresa un valor de volumen válido', 'error');
                return;
            }
            
            alertData.condition = conditionElement.value;
            alertData.value = value;
            alertData.timeframe = timeframeElement.value;
        }

        this.alerts.push(alertData);
        this.activeCount++;
        this.totalCount++;
        
        this.updateDisplay();
        this.saveData();
        this.showMessage(`Alerta de ${alertType} creada correctamente`, 'success');
    }

    testAlert() {
        this.playAlertSound();
        if (Notification.permission === 'granted') {
            new Notification('Test Alert', {
                body: 'Esta es una alerta de prueba',
                icon: '/favicon.ico'
            });
        }
        this.showMessage('Alerta de prueba ejecutada', 'success');
    }

    playAlertSound() {
        // Simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 1);
    }

    startPriceMonitoring() {
        setInterval(() => {
            this.checkAlerts();
        }, 5000);
    }

    async checkAlerts() {
        for (const alert of this.alerts) {
            if (alert.triggered) continue;

            try {
                if (alert.type === 'price') {
                    await this.checkPriceAlert(alert);
                } else if (alert.type === 'indicator') {
                    await this.checkIndicatorAlert(alert);
                } else if (alert.type === 'volume') {
                    await this.checkVolumeAlert(alert);
                }
            } catch (error) {
                console.error(`Error checking ${alert.type} alert:`, error);
            }
        }
    }

    async checkPriceAlert(alert) {
                const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${alert.symbol}`);
                const data = await response.json();
                const currentPrice = parseFloat(data.price);

                let shouldTrigger = false;

                switch (alert.condition) {
                    case 'above':
                        shouldTrigger = currentPrice > alert.value;
                        break;
                    case 'below':
                        shouldTrigger = currentPrice < alert.value;
                        break;
            case 'cross-up':
                // Para implementar cruces necesitaríamos histórico
                shouldTrigger = currentPrice > alert.value;
                break;
            case 'cross-down':
                shouldTrigger = currentPrice < alert.value;
                break;
                }

                if (shouldTrigger) {
            this.triggerAlert(alert, currentPrice, 'precio');
        }
    }

    async checkIndicatorAlert(alert) {
        // Obtener datos históricos para calcular indicadores
        const interval = '1h'; // Usar 1h por defecto
        const limit = Math.max(alert.period * 2, 50); // Asegurar suficientes datos
        
        const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/klines?symbol=${alert.symbol}&interval=${interval}&limit=${limit}`);
        const klines = await response.json();
        
        if (!klines || klines.length < alert.period) {
            console.error('Datos insuficientes para calcular el indicador');
            return;
        }

        // Extraer precios de cierre
        const closePrices = klines.map(kline => parseFloat(kline[4]));
        let indicatorValue;

        // Calcular el indicador según el tipo
        switch (alert.indicator) {
            case 'rsi':
                indicatorValue = this.calculateRSI(closePrices, alert.period);
                break;
            case 'sma':
                indicatorValue = this.calculateSMA(closePrices, alert.period);
                break;
            case 'ema':
                indicatorValue = this.calculateEMA(closePrices, alert.period);
                break;
            case 'macd':
                const macdData = this.calculateMACD(closePrices);
                indicatorValue = macdData.macd;
                break;
            case 'bollinger':
                const bollinger = this.calculateBollinger(closePrices, alert.period);
                indicatorValue = bollinger.middle; // Usar la banda media como referencia
                break;
            default:
                console.error('Indicador no soportado:', alert.indicator);
                return;
        }

        if (indicatorValue === undefined || isNaN(indicatorValue)) {
            console.error('No se pudo calcular el indicador');
            return;
        }

        let shouldTrigger = false;

        switch (alert.condition) {
            case 'above':
                shouldTrigger = indicatorValue > alert.value;
                break;
            case 'below':
                shouldTrigger = indicatorValue < alert.value;
                break;
            case 'cross-up':
                shouldTrigger = indicatorValue > alert.value;
                break;
            case 'cross-down':
                shouldTrigger = indicatorValue < alert.value;
                break;
        }

        if (shouldTrigger) {
            this.triggerAlert(alert, indicatorValue, `${alert.indicator.toUpperCase()}`);
        }
    }

    async checkVolumeAlert(alert) {
        const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${alert.symbol}`);
        const data = await response.json();
        const volume24h = parseFloat(data.volume);

        let shouldTrigger = false;
        let currentValue = volume24h;

        switch (alert.condition) {
            case 'above':
                shouldTrigger = volume24h > alert.value;
                break;
            case 'below':
                shouldTrigger = volume24h < alert.value;
                break;
            case 'spike':
                // Obtener volumen histórico para calcular el aumento
                const klineResponse = await BinanceAPI.fetch(`https://api.binance.com/api/v3/klines?symbol=${alert.symbol}&interval=${alert.timeframe}&limit=24`);
                const klines = await klineResponse.json();
                
                if (klines && klines.length > 1) {
                    const volumes = klines.map(kline => parseFloat(kline[5]));
                    const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
                    const currentVolume = volumes[volumes.length - 1];
                    const increase = ((currentVolume - avgVolume) / avgVolume) * 100;
                    
                    shouldTrigger = increase > alert.value;
                    currentValue = increase;
                }
                break;
            case 'avg-above':
            case 'avg-below':
                // Similar a spike pero comparando con promedio
                const avgResponse = await BinanceAPI.fetch(`https://api.binance.com/api/v3/klines?symbol=${alert.symbol}&interval=${alert.timeframe}&limit=24`);
                const avgKlines = await avgResponse.json();
                
                if (avgKlines && avgKlines.length > 0) {
                    const volumes = avgKlines.map(kline => parseFloat(kline[5]));
                    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
                    
                    shouldTrigger = alert.condition === 'avg-above' ? 
                        volume24h > avgVolume : 
                        volume24h < avgVolume;
                }
                break;
        }

        if (shouldTrigger) {
            this.triggerAlert(alert, currentValue, 'volumen');
        }
    }

    // Métodos para calcular indicadores técnicos
    calculateRSI(prices, period = 14) {
        if (prices.length < period) return undefined;
        
        let gains = 0, losses = 0;
        
        // Calcular ganancias y pérdidas iniciales
        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        // Calcular RSI para los datos restantes
        for (let i = period + 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;
            
            avgGain = ((avgGain * (period - 1)) + gain) / period;
            avgLoss = ((avgLoss * (period - 1)) + loss) / period;
        }
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateSMA(prices, period) {
        if (prices.length < period) return undefined;
        
        const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    calculateEMA(prices, period) {
        if (prices.length < period) return undefined;
        
        const multiplier = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        for (let i = period; i < prices.length; i++) {
            ema = ((prices[i] - ema) * multiplier) + ema;
        }
        
        return ema;
    }

    calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const fastEMA = this.calculateEMA(prices, fastPeriod);
        const slowEMA = this.calculateEMA(prices, slowPeriod);
        
        if (!fastEMA || !slowEMA) return { macd: undefined, signal: undefined };
        
        const macd = fastEMA - slowEMA;
        
        // Para simplificar, retornar solo el MACD
        return { macd: macd, signal: 0 };
    }

    calculateBollinger(prices, period = 20, multiplier = 2) {
        const sma = this.calculateSMA(prices, period);
        if (!sma) return { upper: undefined, middle: undefined, lower: undefined };
        
        // Calcular desviación estándar
        const recentPrices = prices.slice(-period);
        const squaredDiffs = recentPrices.map(price => Math.pow(price - sma, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
        const stdDev = Math.sqrt(avgSquaredDiff);
        
        return {
            upper: sma + (stdDev * multiplier),
            middle: sma,
            lower: sma - (stdDev * multiplier)
        };
    }

    triggerAlert(alert, currentValue, type = 'precio') {
        alert.triggered = true;
        alert.triggeredAt = new Date();
        alert.triggeredValue = currentValue;

        this.triggeredToday++;
        this.activeCount--;

        this.playAlertSound();

        // Crear mensaje personalizado según el tipo de alerta
        let notificationBody;
        if (alert.type === 'price') {
            notificationBody = alert.message || `Precio ${alert.condition === 'above' ? '>' : '<'} ${alert.value}`;
        } else if (alert.type === 'indicator') {
            notificationBody = alert.message || `${alert.indicator.toUpperCase()} ${alert.condition} ${alert.value} (actual: ${currentValue.toFixed(2)})`;
        } else if (alert.type === 'volume') {
            const volumeText = alert.condition === 'spike' ? `aumento de ${currentValue.toFixed(2)}%` : `volumen ${currentValue.toLocaleString()}`;
            notificationBody = alert.message || `Volumen: ${volumeText}`;
        }

        if (Notification.permission === 'granted') {
            new Notification(`Alerta ${type}: ${alert.symbol}`, {
                body: notificationBody,
                icon: '/favicon.ico'
            });
        }

        this.updateDisplay();
        this.saveData();
    }

    removeAlert(alertId) {
        const index = this.alerts.findIndex(alert => alert.id === alertId);
        if (index > -1) {
            this.alerts.splice(index, 1);
            this.activeCount--;
            this.updateDisplay();
            this.saveData();
            this.showMessage('Alerta eliminada', 'success');
        }
    }

    updateDisplay() {
        const activeCountElement = document.getElementById('alerts-active-count');
        const triggeredTodayElement = document.getElementById('alerts-triggered-today');
        const totalCountElement = document.getElementById('alerts-total-count');
        
        if (activeCountElement) activeCountElement.textContent = this.activeCount;
        if (triggeredTodayElement) triggeredTodayElement.textContent = this.triggeredToday;
        if (totalCountElement) totalCountElement.textContent = this.totalCount;
        
        this.updateActiveAlertsList();
    }

    updateActiveAlertsList() {
        const container = document.getElementById('activeAlerts');
        if (!container) return;
        
        if (this.alerts.length === 0) {
            container.innerHTML = `
                <div class="alert-item">
                    <div style="text-align: center; color: #bdc3c7; padding: 20px;">
                        No hay alertas activas. Crea una nueva alerta usando el formulario.
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.alerts.map(alert => {
            let alertDescription;
            if (alert.type === 'price') {
                alertDescription = `Precio ${alert.condition === 'above' ? '>' : '<'} ${alert.value}`;
            } else if (alert.type === 'indicator') {
                alertDescription = `${alert.indicator.toUpperCase()}(${alert.period}) ${alert.condition} ${alert.value}`;
            } else if (alert.type === 'volume') {
                let conditionText;
                switch (alert.condition) {
                    case 'above': conditionText = `Volumen > ${alert.value.toLocaleString()}`; break;
                    case 'below': conditionText = `Volumen < ${alert.value.toLocaleString()}`; break;
                    case 'spike': conditionText = `Pico volumen > ${alert.value}%`; break;
                    case 'avg-above': conditionText = 'Volumen > promedio'; break;
                    case 'avg-below': conditionText = 'Volumen < promedio'; break;
                    default: conditionText = `Volumen ${alert.condition} ${alert.value}`;
                }
                alertDescription = conditionText;
            } else {
                alertDescription = `${alert.condition} ${alert.value}`;
            }

            return `
            <div class="alert-item ${alert.triggered ? 'alert-triggered' : 'alert-active'}">
                <div>
                        <strong>${alert.symbol}</strong> <small>[${alert.type}]</small><br>
                        ${alertDescription}
                    ${alert.message ? '<br><small>' + alert.message + '</small>' : ''}
                </div>
                <div>
                    <span style="color: ${alert.triggered ? '#e74c3c' : '#2ecc71'};">
                        ${alert.triggered ? 'Disparada' : 'Activa'}
                    </span>
                    <button onclick="removeAlert(${alert.id})" 
                            style="margin-left: 10px; padding: 2px 6px; background: #e74c3c; border: none; border-radius: 3px; color: white; cursor: pointer;">
                        ×
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    loadData() {
        const data = DataManager.loadData('alertsData');
        if (data) {
            this.alerts = data.alerts || [];
            this.activeCount = data.activeCount || 2;
            this.triggeredToday = data.triggeredToday || 5;
            this.totalCount = data.totalCount || 24;
        }
    }

    saveData() {
        DataManager.saveData('alertsData', {
            alerts: this.alerts,
            activeCount: this.activeCount,
            triggeredToday: this.triggeredToday,
            totalCount: this.totalCount
        });
    }

    showMessage(message, type) {
        const messageArea = document.getElementById('messageArea-alerts');
        if (messageArea) {
            const messageDiv = document.createElement('div');
            messageDiv.className = type;
            messageDiv.textContent = message;
            
            messageArea.innerHTML = '';
            messageArea.appendChild(messageDiv);
            
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.remove();
                }
            }, 3000);
        }
    }
}
