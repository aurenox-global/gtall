/**
 * Bot de grid trading en Futuros (simulado).
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class FuturesGridTradingBot {
    constructor() {
        this.isRunning = false;
        this.currentPrice = 0;
        this.priceHistory = [];
        this.profits = [];
        this.totalProfit = 0;
        this.gridProfit = 0;
        this.unrealizedPnl = 0;
        this.completedTrades = 0;
        this.gridLevels = [];
        this.priceChart = null;
        this.updateInterval = null;
        this.simulationSpeed = 200;
        this.historicalData = null;
        this.historicalIndex = 0;
        this.lastPrice = 0;
        this.gridExecutions = [];
        this.fundingFeeInterval = null;
        this.totalFundingFees = 0;
        this.lastFundingTime = 0;
        this.mode = 'long';
        this.leverage = 10;
        this.margin = 0;
        this.positionSize = 0;
        this.averageEntryPrice = 0;
        this.openPositions = [];
        this.liquidationPrice = 0;
        this.cryptoPercentage = 50;
        this.usdtPercentage = 50;
        this.cryptoAllocation = 0;
        this.usdtAllocation = 0;
        this.gridOrders = [];
        this.suffix = '-futures';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeChart();
        this.setDefaultDates();
        this.updateAllocationCalculations();
        this.updateGridCalculations();
        this.getCurrentPrice();
        this.updateModeInfo();
        this.updateSymbolDisplay();
    }

    setupEventListeners() {
        document.getElementById(`startBot${this.suffix}`).addEventListener('click', () => this.startBot());
        document.getElementById(`stopBot${this.suffix}`).addEventListener('click', () => this.stopBot());
        
        ['maxPrice', 'minPrice', 'gridCount', 'investment'].forEach(id => {
            const element = document.getElementById(`${id}${this.suffix}`);
            if (element) {
                element.addEventListener('input', () => {
                    this.updateAllocationCalculations();
                    this.updateGridCalculations();
                    if (id === 'maxPrice' || id === 'minPrice') {
                        this.checkPriceRangeStatus();
                    }
                });
            }
        });

        const cryptoPercentageElement = document.getElementById(`cryptoPercentage${this.suffix}`);
        if (cryptoPercentageElement) {
            cryptoPercentageElement.addEventListener('input', (e) => {
                this.handleAllocationChange('crypto', parseInt(e.target.value));
            });
        }

        const usdtPercentageElement = document.getElementById(`usdtPercentage${this.suffix}`);
        if (usdtPercentageElement) {
            usdtPercentageElement.addEventListener('input', (e) => {
                this.handleAllocationChange('usdt', parseInt(e.target.value));
            });
        }

        const symbolElement = document.getElementById(`symbol${this.suffix}`);
        if (symbolElement) {
            symbolElement.addEventListener('change', () => {
                this.getCurrentPrice();
                this.updateGridCalculations();
                this.updateSymbolDisplay();
                this.updateAllocationCalculations();
            });
        }

        document.querySelectorAll('#futures-grid .mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#futures-grid .mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
                this.updateModeInfo();
                this.updateGridCalculations();
                
                // Recalcular órdenes si el bot está ejecutándose
                if (this.isRunning) {
                    this.initializeGridOrders();
                }
            });
        });

        document.querySelectorAll('#futures-grid .leverage-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#futures-grid .leverage-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.leverage = parseInt(btn.dataset.leverage);
                this.updateGridCalculations();
            });
        });
    }

    updateSymbolDisplay() {
        const symbolElement = document.getElementById(`symbol${this.suffix}`);
        const symbol = symbolElement ? symbolElement.value : 'BTCUSDT';
        const cryptoSymbol = symbol.replace('USDT', '');
        const cryptoSymbolElement = document.getElementById(`cryptoSymbol${this.suffix}`);
        if (cryptoSymbolElement) {
            cryptoSymbolElement.textContent = cryptoSymbol;
        }
        this.updateAllocationCalculations();
    }

    handleAllocationChange(type, value) {
        if (value < 0) value = 0;
        if (value > 100) value = 100;
        
        if (type === 'crypto') {
            this.cryptoPercentage = value;
            this.usdtPercentage = 100 - value;
            const usdtElement = document.getElementById(`usdtPercentage${this.suffix}`);
            if (usdtElement) usdtElement.value = this.usdtPercentage;
        } else {
            this.usdtPercentage = value;
            this.cryptoPercentage = 100 - value;
            const cryptoElement = document.getElementById(`cryptoPercentage${this.suffix}`);
            if (cryptoElement) cryptoElement.value = this.cryptoPercentage;
        }
        
        this.updateAllocationCalculations();
        this.updateGridCalculations();
    }

    updateAllocationCalculations() {
        const totalMargin = parseFloat(document.getElementById(`investment${this.suffix}`).value) || 0;
        const symbolElement = document.getElementById(`symbol${this.suffix}`);
        const symbol = symbolElement ? symbolElement.value : 'BTCUSDT';
        const cryptoSymbol = symbol.replace('USDT', '');
        
        this.cryptoAllocation = (totalMargin * this.cryptoPercentage) / 100;
        this.usdtAllocation = (totalMargin * this.usdtPercentage) / 100;
        
        const allocationInfo = document.getElementById(`allocationInfo${this.suffix}`);
        if (allocationInfo) {
            allocationInfo.innerHTML = `
                📊 Asignación: ${this.cryptoPercentage}% ${cryptoSymbol} (~${this.cryptoAllocation.toFixed(0)} USDT) + 
                ${this.usdtPercentage}% USDT (${this.usdtAllocation.toFixed(0)} USDT)
            `;
        }

        const currentAllocation = document.getElementById(`currentAllocation${this.suffix}`);
        if (currentAllocation) {
            currentAllocation.textContent = `${this.cryptoPercentage}% ${cryptoSymbol} + ${this.usdtPercentage}% USDT`;
        }
    }

    updateModeInfo() {
        const modeInfo = document.getElementById(`modeInfo${this.suffix}`);
        const modes = {
            neutral: '<strong>NEUTRAL:</strong> Sin posición inicial. Alterna entre long y short según movimiento del precio. <br>🔄 <em>Compra cuando baja, vende cuando sube</em>',
            long: '<strong>LONG:</strong> Adecuado para mercados alcistas volátiles. <br>📈 <em>Compra en niveles bajos, vende en niveles altos</em>',
            short: '<strong>SHORT:</strong> Adecuado para mercados bajistas volátiles. <br>📉 <em>Vende en niveles altos, compra en niveles bajos</em>'
        };
        if (modeInfo) {
            modeInfo.innerHTML = modes[this.mode];
        }
        
        // Actualizar información adicional del modo
        this.updateModeDetails();
    }
    
    updateModeDetails() {
        const modeDetailsElement = document.getElementById(`modeDetails${this.suffix}`);
        if (!modeDetailsElement) return;
        
        let details = '';
        switch (this.mode) {
            case 'neutral':
                details = `Estrategia de mercado neutral que se adapta automáticamente. 
                <br>• Compra cuando el precio baja hasta los niveles configurados
                <br>• Vende cuando el precio sube hasta los niveles configurados
                <br>• Sin sesgo direccional inicial`;
                break;
            case 'long':
                details = `Estrategia alcista optimizada para mercados con tendencia al alza.
                <br>• Compra en todos los niveles por debajo del precio actual
                <br>• Vende cuando el precio sube para tomar ganancias
                <br>• Ideal para mercados volátiles con tendencia alcista`;
                break;
            case 'short':
                details = `Estrategia bajista optimizada para mercados con tendencia a la baja.
                <br>• Vende en todos los niveles por encima del precio actual
                <br>• Compra cuando el precio baja para cubrir posiciones
                <br>• Ideal para mercados volátiles con tendencia bajista`;
                break;
        }
        
        modeDetailsElement.innerHTML = details;
    }

    setDefaultDates() {
        const startDate = new Date('2025-08-20T10:00:00');
        const endDate = new Date();
        
        const startElement = document.getElementById(`startDate${this.suffix}`);
        const endElement = document.getElementById(`endDate${this.suffix}`);
        
        if (startElement) startElement.value = startDate.toISOString().slice(0, 16);
        if (endElement) endElement.value = endDate.toISOString().slice(0, 16);
    }

    updateGridCalculations() {
        const maxPrice = parseFloat(document.getElementById(`maxPrice${this.suffix}`).value);
        const minPrice = parseFloat(document.getElementById(`minPrice${this.suffix}`).value);
        const gridCount = parseInt(document.getElementById(`gridCount${this.suffix}`).value);
        const margin = parseFloat(document.getElementById(`investment${this.suffix}`).value);

        if (maxPrice <= minPrice) {
            this.showMessage('El precio superior debe ser mayor al inferior', 'error');
            return;
        }
        
        // Verificar si el precio actual está dentro del rango configurado
        if (this.currentPrice > 0) {
            if (this.currentPrice < minPrice || this.currentPrice > maxPrice) {
                this.showMessage(`⚠️ El precio actual (${this.currentPrice.toFixed(2)} USDT) está fuera del rango configurado (${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} USDT). El bot no se puede iniciar hasta que el precio entre en el rango.`, 'warning');
            } else {
                // Limpiar mensajes de advertencia anteriores si el precio está en rango
                const existingWarning = document.querySelector('.price-range-warning');
                if (existingWarning) {
                    existingWarning.remove();
                }
            }
        }

        const priceRange = maxPrice - minPrice;
        const gridInterval = priceRange / (gridCount - 1);
        const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value) || ((maxPrice + minPrice) / 2);
        
        // Calcular el capital total disponible con apalancamiento
        const totalCapitalWithLeverage = margin * this.leverage;
        const availableMarginPerGrid = margin / gridCount; // Margen real por grid
        const capitalPerGrid = totalCapitalWithLeverage / gridCount; // Capital con apalancamiento por grid
        const positionSizePerGrid = capitalPerGrid / entryPrice;
        
        const tradingAmountElement = document.getElementById(`tradingAmount${this.suffix}`);
        if (tradingAmountElement) {
            tradingAmountElement.value = capitalPerGrid.toFixed(2);
        }
        
        this.calculateLiquidationPrice(entryPrice, margin);
        
        const elements = {
            [`tradingRange${this.suffix}`]: `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`,
            [`gridInterval${this.suffix}`]: `${gridInterval.toFixed(2)} USDT`,
            [`positionPerGrid${this.suffix}`]: `${positionSizePerGrid.toFixed(6)} BTC`,
            [`currentMode${this.suffix}`]: this.mode.toUpperCase(),
            [`currentLeverage${this.suffix}`]: `${this.leverage}x`
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Niveles desde la implementación única y testeada (grid-math.js)
        this.gridLevels = GridMath.computeLevels({ minPrice, maxPrice, gridCount })
            .map(price => ({
                price,
                positionSize: positionSizePerGrid,
                margin: availableMarginPerGrid,
                filled: false
            }));

        this.margin = margin;
        this.gridInterval = gridInterval;
    }

    calculateLiquidationPrice(entryPrice, margin) {
        const maintenanceMarginRate = 0.005;
        const fees = 0.001;
        
        let liquidationPrice;
        if (this.mode === 'long') {
            liquidationPrice = entryPrice * (1 - (1/this.leverage) + maintenanceMarginRate + fees);
        } else if (this.mode === 'short') {
            liquidationPrice = entryPrice * (1 + (1/this.leverage) + maintenanceMarginRate + fees);
        } else {
            liquidationPrice = entryPrice;
        }
        
        this.liquidationPrice = liquidationPrice;
        const liquidationElement = document.getElementById(`liquidationPrice${this.suffix}`);
        if (liquidationElement) {
            liquidationElement.textContent = liquidationPrice.toFixed(2) + ' USDT';
            
            if (Math.abs(this.currentPrice - liquidationPrice) / this.currentPrice < 0.1) {
                liquidationElement.style.color = '#e74c3c';
            } else if (Math.abs(this.currentPrice - liquidationPrice) / this.currentPrice < 0.2) {
                liquidationElement.style.color = '#f39c12';
            } else {
                liquidationElement.style.color = '#2ecc71';
            }
        }
    }

    async getCurrentPrice() {
        try {
            const symbolElement = document.getElementById(`symbol${this.suffix}`);
            const symbol = symbolElement ? symbolElement.value : 'BTCUSDT';
            const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
            const data = await response.json();
            
            // Update connection status
            this.updateConnectionStatus(true);
            
            this.currentPrice = parseFloat(data.price);
            const currentPriceElement = document.getElementById(`currentPrice${this.suffix}`);
            if (currentPriceElement) {
                currentPriceElement.textContent = 
                    `${this.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT`;
            }
            
            // NO cambiar el precio de activación automáticamente
            // El usuario debe configurarlo manualmente
            // if (!this.isRunning) {
            //     const entryPriceElement = document.getElementById(`entryPrice${this.suffix}`);
            //     if (entryPriceElement) {
            //         entryPriceElement.value = this.currentPrice;
            //     }
            // }
            
            this.updateAllocationCalculations();
            this.updateGridCalculations();
            
            // Verificar si el precio está dentro del rango configurado
            this.checkPriceRangeStatus();
        } catch (error) {
            this.updateConnectionStatus(false);
            this.showMessage('Error al obtener precio actual: ' + error.message, 'error');
        }
    }
    
    checkPriceRangeStatus() {
        const maxPrice = parseFloat(document.getElementById(`maxPrice${this.suffix}`).value) || 0;
        const minPrice = parseFloat(document.getElementById(`minPrice${this.suffix}`).value) || 0;
        
        if (maxPrice <= 0 || minPrice <= 0) return;
        
        const priceRangeElement = document.getElementById(`tradingRange${this.suffix}`);
        if (!priceRangeElement) return;
        
        if (this.currentPrice < minPrice || this.currentPrice > maxPrice) {
            priceRangeElement.style.color = '#e74c3c';
            priceRangeElement.style.fontWeight = 'bold';
            priceRangeElement.innerHTML = `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} <span style="color: #f39c12;">⚠️ Precio fuera de rango</span>`;
        } else {
            priceRangeElement.style.color = '#2ecc71';
            priceRangeElement.style.fontWeight = 'normal';
            priceRangeElement.innerHTML = `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
        }
        
        // Mostrar información sobre el estado de activación
        this.updateGridActivationStatus();
    }
    
    updateGridActivationStatus() {
        if (!this.isRunning || !this.currentPrice) return;
        
        const maxPrice = parseFloat(document.getElementById(`maxPrice${this.suffix}`).value) || 0;
        const minPrice = parseFloat(document.getElementById(`minPrice${this.suffix}`).value) || 0;
        
        if (maxPrice <= 0 || minPrice <= 0) return;
        
        let statusMessage = '';
        if (this.currentPrice < minPrice) {
            statusMessage = `⏳ Esperando que el precio baje hasta ${minPrice.toFixed(2)} USDT para activar la rejilla`;
        } else if (this.currentPrice > maxPrice) {
            statusMessage = `⏳ Esperando que el precio suba hasta ${maxPrice.toFixed(2)} USDT para activar la rejilla`;
        } else {
            statusMessage = `✅ Rejilla activa - Precio dentro del rango de trading`;
        }
        
        // Buscar un elemento para mostrar el estado
        const statusElement = document.getElementById(`gridStatus${this.suffix}`);
        if (statusElement) {
            statusElement.innerHTML = statusMessage;
            statusElement.style.color = this.currentPrice >= minPrice && this.currentPrice <= maxPrice ? '#2ecc71' : '#f39c12';
        }
    }

    updateConnectionStatus(connected) {
        // El badge de la cabecera lo gobierna src/core/status-badge.js con el
        // estado real del cliente Binance; aquí solo guardamos el último dato.
        this.connectionOk = connected;
    }

    initializeChart() {
        const ctx = document.getElementById(`priceChart${this.suffix}`);
        if (!ctx) return;
        
        this.priceChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Precio',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'PnL Total',
                    data: [],
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ecf0f1'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#bdc3c7' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: '#bdc3c7' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        ticks: { color: '#2ecc71' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    async startBot() {
        if (this.isRunning) return;

        try {
            // Obtener precio actual antes de validar
            await this.getCurrentPrice();
            
            // Verificar que el precio esté en el rango antes de continuar
            const maxPrice = parseFloat(document.getElementById(`maxPrice${this.suffix}`).value);
            const minPrice = parseFloat(document.getElementById(`minPrice${this.suffix}`).value);
            
            // Permitir iniciar el bot si el precio está en el rango o si se usará simulación histórica
            // La simulación histórica verificará si el precio pasa por el rango en algún momento
            if (this.currentPrice < minPrice || this.currentPrice > maxPrice) {
                console.log(`⚠️ Precio actual (${this.currentPrice.toFixed(2)} USDT) fuera del rango (${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} USDT). Verificando datos históricos...`);
            }
            
            this.validateInputs();
            this.showMessage('Cargando datos históricos...', 'success');
            
            await this.loadHistoricalData();
            
            this.isRunning = true;
            this.updateButtonStates();
            this.resetSimulation();
            this.initializeGridOrders();
            this.startHistoricalSimulation();
            this.startFundingFeeTimer();
            
            const symbol = document.getElementById(`symbol${this.suffix}`).value.replace('USDT', '');
            this.showMessage(
                `Bot iniciado - Modo ${this.mode.toUpperCase()} con ${this.leverage}x leverage | Asignación: ${this.cryptoPercentage}% ${symbol} + ${this.usdtPercentage}% USDT`, 
                'success'
            );
        } catch (error) {
            this.showMessage('Error al iniciar bot: ' + error.message, 'error');
            this.isRunning = false;
            this.updateButtonStates();
        }
    }

    validateInputs() {
        const maxPrice = parseFloat(document.getElementById(`maxPrice${this.suffix}`).value);
        const minPrice = parseFloat(document.getElementById(`minPrice${this.suffix}`).value);
        const investment = parseFloat(document.getElementById(`investment${this.suffix}`).value);
        const gridCount = parseInt(document.getElementById(`gridCount${this.suffix}`).value);
        const currentPrice = this.currentPrice || parseFloat(document.getElementById(`currentPrice${this.suffix}`)?.textContent?.replace(' USDT', '').replace(/,/g, '')) || 0;

        if (maxPrice <= minPrice) throw new Error('Precio superior debe ser mayor al inferior');
        if (investment < 10) throw new Error('Margen mínimo: 10 USDT');
        if (gridCount < 2) throw new Error('Mínimo 2 rejillas');
        if (gridCount > 150) throw new Error('Máximo 150 rejillas');
        
        if (this.cryptoPercentage + this.usdtPercentage !== 100) {
            throw new Error('La suma de los porcentajes debe ser 100%');
        }
        if (this.cryptoPercentage < 0 || this.usdtPercentage < 0) {
            throw new Error('Los porcentajes no pueden ser negativos');
        }
        
        // Validar que el precio actual se pueda obtener
        if (currentPrice <= 0) {
            throw new Error('No se puede obtener el precio actual. Verifica la conexión.');
        }
        
        // Permitir precios fuera del rango para simulación histórica
        // La simulación verificará si el precio pasa por el rango en algún momento
        if (currentPrice < minPrice || currentPrice > maxPrice) {
            console.log(`⚠️ Precio actual (${currentPrice.toFixed(2)} USDT) fuera del rango (${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} USDT). Continuando con simulación histórica...`);
        }
    }

    resetSimulation() {
        this.totalProfit = 0;
        this.gridProfit = 0;
        this.unrealizedPnl = 0;
        this.completedTrades = 0;
        this.priceHistory = [];
        this.profits = [];
        this.gridExecutions = [];
        this.openPositions = [];
        this.totalFundingFees = 0;
        this.lastPrice = this.currentPrice || 0; // Inicializar con el precio actual
        this.historicalIndex = 0;
        this.gridOrders = [];
        this.updateDisplay();
        
        if (this.priceChart) {
            this.priceChart.data.labels = [];
            this.priceChart.data.datasets[0].data = [];
            this.priceChart.data.datasets[1].data = [];
            this.priceChart.update();
        }
    }

    async loadHistoricalData() {
        const symbolElement = document.getElementById(`symbol${this.suffix}`);
        const startDateElement = document.getElementById(`startDate${this.suffix}`);
        const endDateElement = document.getElementById(`endDate${this.suffix}`);
        
        const symbol = symbolElement ? symbolElement.value : 'BTCUSDT';
        const startDate = startDateElement ? startDateElement.value : '';
        const endDate = endDateElement ? endDateElement.value : '';
        
        if (!startDate || !endDate) {
            throw new Error('Por favor selecciona fechas válidas');
        }

        const startTime = new Date(startDate).getTime();
        const endTime = new Date(endDate).getTime();
        
        if (startTime >= endTime) {
            throw new Error('La fecha de inicio debe ser anterior a la fecha final');
        }

        this.selectedStartTime = startTime;
        this.selectedEndTime = endTime;

        // Selección de intervalo según rango
        const rangeMs = endTime - startTime;
        const oneDay = 24 * 60 * 60 * 1000;
        let interval = '5m';
        if (rangeMs > 10 * oneDay && rangeMs <= 30 * oneDay) interval = '15m';
        else if (rangeMs > 30 * oneDay && rangeMs <= 180 * oneDay) interval = '1h';
        else if (rangeMs > 180 * oneDay && rangeMs <= 720 * oneDay) interval = '4h';
        else if (rangeMs > 720 * oneDay) interval = '1d';

        try {
            const klines = await this.fetchKlinesPaginated(symbol, interval, startTime, endTime);
            this.historicalData = klines;
            this.historicalIndex = 0;
            if (this.historicalData.length === 0) {
                throw new Error('No se encontraron datos para el período seleccionado');
            }
            console.log(`Cargados ${this.historicalData.length} puntos (${interval})`);
        } catch (error) {
            throw new Error(`Error al cargar datos históricos: ${error.message}`);
        }
    }

    async fetchKlinesPaginated(symbol, interval, startTime, endTime) {
        const all = [];
        let from = startTime;
        const limit = 1000;
        while (from < endTime) {
            const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${from}&endTime=${endTime}&limit=${limit}`;
            const res = await BinanceAPI.fetch(url);
            if (!res.ok) throw new Error(`API ${res.status}`);
            const batch = await res.json();
            if (!Array.isArray(batch) || batch.length === 0) break;
            all.push(...batch);
            const lastOpenTime = batch[batch.length - 1][0];
            from = lastOpenTime + 1;
            if (batch.length < limit) break;
        }
        return all;
    }
    
    checkHistoricalPriceRange() {
        const maxPrice = parseFloat(document.getElementById(`maxPrice${this.suffix}`).value);
        const minPrice = parseFloat(document.getElementById(`minPrice${this.suffix}`).value);
        const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value);
        
        if (!this.historicalData || this.historicalData.length === 0) return;
        
        let priceInRange = false;
        let minHistoricalPrice = Infinity;
        let maxHistoricalPrice = -Infinity;
        
        // Verificar si algún precio histórico está en el rango
        this.historicalData.forEach(candle => {
            const price = parseFloat(candle[4]); // Precio de cierre
            minHistoricalPrice = Math.min(minHistoricalPrice, price);
            maxHistoricalPrice = Math.max(maxHistoricalPrice, price);
            
            if (price >= minPrice && price <= maxPrice) {
                priceInRange = true;
            }
        });
        
        if (priceInRange) {
            console.log(`✅ El precio histórico pasa por el rango configurado (${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} USDT)`);
            console.log(`📊 Rango histórico: ${minHistoricalPrice.toFixed(2)} - ${maxHistoricalPrice.toFixed(2)} USDT`);
            this.showMessage(`✅ Datos históricos válidos. El precio pasa por el rango configurado en algún momento del período seleccionado.`, 'success');
        } else {
            console.log(`⚠️ El precio histórico NO pasa por el rango configurado (${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)} USDT)`);
            console.log(`📊 Rango histórico: ${minHistoricalPrice.toFixed(2)} - ${maxHistoricalPrice.toFixed(2)} USDT`);
            this.showMessage(`⚠️ Advertencia: El precio histórico no pasa por el rango configurado. Considera ajustar las fechas o los precios.`, 'warning');
        }
    }

    initializeGridOrders() {
        this.gridOrders = [];
        const maxPrice = parseFloat(document.getElementById(`maxPrice${this.suffix}`).value);
        const minPrice = parseFloat(document.getElementById(`minPrice${this.suffix}`).value);
        const gridCount = parseInt(document.getElementById(`gridCount${this.suffix}`).value);
        const margin = parseFloat(document.getElementById(`investment${this.suffix}`).value);
        const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value) || this.currentPrice;
        
        const priceRange = maxPrice - minPrice;
        const gridInterval = priceRange / (gridCount - 1);
        const marginPerGrid = margin / gridCount; // Margen real por grid
        const totalCapitalWithLeverage = margin * this.leverage;
        const capitalPerGrid = totalCapitalWithLeverage / gridCount; // Capital con apalancamiento por grid
        
        for (let i = 0; i < gridCount; i++) {
            const price = minPrice + (i * gridInterval);
            const positionSize = capitalPerGrid / price;
            
            // Configurar órdenes según el modo seleccionado
            let buyOrderActive = false;
            let sellOrderActive = false;
            
            if (this.mode === 'neutral') {
                // Modo neutral: usar el precio de entrada configurado por el usuario
                buyOrderActive = price < entryPrice;
                sellOrderActive = price > entryPrice;
            } else if (this.mode === 'long') {
                // Modo long: comprar en todos los niveles por debajo del precio de entrada
                buyOrderActive = price <= entryPrice;
                sellOrderActive = false; // Solo se activa después de comprar
            } else if (this.mode === 'short') {
                // Modo short: vender en todos los niveles por encima del precio de entrada
                buyOrderActive = false; // Solo se activa después de vender
                sellOrderActive = price >= entryPrice;
            }
            
            this.gridOrders.push({
                id: i,
                price: price,
                positionSize: positionSize,
                margin: marginPerGrid,
                buyOrderActive: buyOrderActive,
                sellOrderActive: sellOrderActive,
                position: null,
                availableCrypto: this.cryptoAllocation * this.leverage / gridCount / price,
                availableUsdt: this.usdtAllocation / gridCount,
                mode: this.mode,
                entryPrice: entryPrice
            });
        }
        
        console.log(`Rejilla inicializada en modo ${this.mode.toUpperCase()} con precio de entrada ${entryPrice.toFixed(2)} USDT: ${this.gridOrders.filter(o => o.buyOrderActive).length} órdenes de compra, ${this.gridOrders.filter(o => o.sellOrderActive).length} órdenes de venta`);
    }

    startHistoricalSimulation() {
        this.updateInterval = setInterval(() => {
            if (!this.isRunning) return;

            try {
                this.simulateGridTrading();
                
                if (this.historicalIndex % 3 === 0) {
                    this.updateChart();
                    this.updateDisplay();
                }
            } catch (error) {
                console.error('Simulation error:', error);
                this.showMessage('Error en simulación: ' + error.message, 'error');
            }
        }, this.simulationSpeed);
    }

    startFundingFeeTimer() {
        this.fundingFeeInterval = setInterval(() => {
            this.calculateFundingFee();
        }, 30000);
    }

    calculateFundingFee() {
        if (this.openPositions.length === 0) return;

        const fundingRate = (Math.random() - 0.5) * 0.00002;
        
        this.openPositions.forEach(position => {
            const fundingFee = position.size * this.currentPrice * Math.abs(fundingRate);
            this.totalFundingFees += fundingFee * (fundingRate > 0 ? -1 : 1);
        });

        const fundingElement = document.getElementById(`totalFundingFees${this.suffix}`);
        if (fundingElement) {
            const sign = this.totalFundingFees >= 0 ? '+' : '';
            fundingElement.textContent = `${sign}${this.totalFundingFees.toFixed(2)} USDT`;
        }
    }

    async simulateGridTrading() {
        if (this.historicalData && this.historicalIndex < this.historicalData.length) {
            const currentData = this.historicalData[this.historicalIndex];
            const simulatedPrice = parseFloat(currentData[4]);
            
            this.priceHistory.push({
                time: new Date(currentData[6]),
                price: simulatedPrice
            });

            this.processGridOrders(simulatedPrice);
            this.calculateUnrealizedPnL(simulatedPrice);
            
            this.totalProfit = this.gridProfit + this.unrealizedPnl + this.totalFundingFees;
            this.profits.push(this.totalProfit);
            
            this.historicalIndex++;
            
            const currentPriceElement = document.getElementById(`currentPrice${this.suffix}`);
            if (currentPriceElement) {
                currentPriceElement.textContent = 
                    `${simulatedPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT`;
            }
        } else {
            try {
                const symbolElement = document.getElementById(`symbol${this.suffix}`);
                const symbol = symbolElement ? symbolElement.value : 'BTCUSDT';
                const now = Date.now();
                if (this.selectedEndTime && (now - this.selectedEndTime) < (24 * 60 * 60 * 1000)) {
                    const resp = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
                    const data = await resp.json();
                    const livePrice = parseFloat(data.price);
                    if (!isNaN(livePrice)) {
                        this.processGridOrders(livePrice);
                        const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value);
                        const totalInvestment = parseFloat(document.getElementById(`investment${this.suffix}`).value);
                        const priceChange = (livePrice - entryPrice) / entryPrice;
                        const positionSizePerGrid = parseFloat(document.getElementById(`positionPerGrid${this.suffix}`)?.textContent) || 0;
                        // PnL no realizado ya se mantiene; solo actualizamos último precio
                        this.priceHistory.push({ time: new Date(now), price: livePrice });
                        const currentPriceElement = document.getElementById(`currentPrice${this.suffix}`);
                        if (currentPriceElement) {
                            currentPriceElement.textContent = `${livePrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT`;
                        }
                        this.updateChart();
                        this.updateDisplay();
                    }
                }
            } catch (e) {}
            this.stopBot();
            this.showMessage('Simulación completada con datos históricos', 'success');
        }
    }

    processGridOrders(currentPrice) {
        // Solo procesar órdenes si el bot está ejecutándose
        if (!this.isRunning) return;
        
        this.gridOrders.forEach(order => {
            // Para órdenes de compra: solo ejecutar si el precio BAJA hasta el nivel (toca desde arriba)
            if (order.buyOrderActive && !order.position && this.lastPrice > order.price && currentPrice <= order.price) {
                if (this.canExecuteBuyOrder(order, currentPrice)) {
                    this.executeBuyOrder(order, currentPrice);
                }
            }
            
            // Para órdenes de venta: solo ejecutar si el precio SUBE hasta el nivel (toca desde abajo)
            if (order.sellOrderActive && order.position && this.lastPrice < order.price && currentPrice >= order.price) {
                this.executeSellOrder(order, currentPrice);
            }
            
            // Lógica específica para modo neutral: alternar entre long y short
            if (this.mode === 'neutral' && !order.position) {
                if (order.buyOrderActive && this.lastPrice > order.price && currentPrice <= order.price) {
                    // Precio bajó hasta el nivel de compra
                    if (this.canExecuteBuyOrder(order, currentPrice)) {
                        this.executeBuyOrder(order, currentPrice);
                    }
                } else if (order.sellOrderActive && this.lastPrice < order.price && currentPrice >= order.price) {
                    // Precio subió hasta el nivel de venta
                    if (this.canExecuteSellOrder(order, currentPrice)) {
                        this.executeSellOrder(order, currentPrice);
                    }
                }
            }
        });
        
        // Actualizar el último precio para la próxima comparación
        this.lastPrice = currentPrice;
    }

    canExecuteBuyOrder(order, currentPrice) {
        // Verificar que hay fondos disponibles
        if (!(order.availableUsdt > 0 || order.availableCrypto > 0)) {
            return false;
        }
        
        // Verificar que el precio realmente tocó el nivel desde arriba
        if (this.lastPrice <= order.price) {
            return false;
        }
        
        // Verificar que el precio actual está en o por debajo del nivel
        if (currentPrice > order.price) {
            return false;
        }
        
        return true;
    }
    
    canExecuteSellOrder(order, currentPrice) {
        // Verificar que hay una posición abierta
        if (!order.position) {
            return false;
        }
        
        // Verificar que el precio realmente tocó el nivel desde abajo
        if (this.lastPrice >= order.price) {
            return false;
        }
        
        // Verificar que el precio actual está en o por encima del nivel
        if (currentPrice < order.price) {
            return false;
        }
        
        return true;
    }

    executeBuyOrder(order, currentPrice) {
        // Verificación adicional de seguridad
        if (!this.canExecuteBuyOrder(order, currentPrice)) {
            return;
        }
        
        // Determinar el tipo de posición según el modo
        let positionType = 'long';
        if (this.mode === 'short') {
            positionType = 'short';
        } else if (this.mode === 'neutral') {
            // En modo neutral, alternar entre long y short según el movimiento del precio
            positionType = this.lastPrice > currentPrice ? 'long' : 'short';
        }
        
        const position = {
            id: order.id,
            type: positionType,
            entryPrice: currentPrice,
            size: order.positionSize,
            margin: order.margin,
            timestamp: Date.now()
        };
        
        order.position = position;
        this.openPositions.push(position);
        
        // Configurar la siguiente orden según el modo
        if (this.mode === 'neutral') {
            // En modo neutral, después de comprar, activar la venta
            order.sellOrderActive = true;
            order.buyOrderActive = false;
        } else if (this.mode === 'long') {
            // En modo long, después de comprar, activar la venta
            order.sellOrderActive = true;
            order.buyOrderActive = false;
        } else if (this.mode === 'short') {
            // En modo short, después de vender, activar la compra
            order.buyOrderActive = true;
            order.sellOrderActive = false;
        }
        
        this.gridExecutions.push({
            type: positionType === 'long' ? 'OPEN_LONG' : 'OPEN_SHORT',
            price: currentPrice,
            size: position.size,
            profit: 0,
            time: new Date()
        });
        
        // Log de la ejecución para debugging
        console.log(`🟢 ${positionType.toUpperCase()} ejecutado en nivel ${order.id}: ${currentPrice} USDT (precio anterior: ${this.lastPrice})`);
    }

    executeSellOrder(order, currentPrice) {
        const position = order.position;
        if (!position) return;
        
        // Verificar que el precio realmente tocó el nivel desde abajo
        if (this.lastPrice >= order.price) {
            return;
        }
        
        // Verificar que el precio actual está en o por encima del nivel
        if (currentPrice < order.price) {
            return;
        }
        
        let profit = this.calculateTradeProfit(position, currentPrice);
        
        // Acumular el profit en gridProfit (solo ganancias realizadas)
        // Asegurar que siempre se sume el profit, nunca se reste
        this.gridProfit += Math.abs(profit);
        this.completedTrades++;
        
        // Log detallado del profit acumulado
        console.log(`💰 Profit acumulado: ${profit.toFixed(2)} USDT | Total Grid Profit: ${this.gridProfit.toFixed(2)} USDT`);
        
        const posIndex = this.openPositions.indexOf(position);
        if (posIndex > -1) {
            this.openPositions.splice(posIndex, 1);
        }
        
        order.position = null;
        
        // Configurar la siguiente orden según el modo
        if (this.mode === 'neutral') {
            // En modo neutral, después de vender, activar la compra
            order.buyOrderActive = true;
            order.sellOrderActive = false;
        } else if (this.mode === 'long') {
            // En modo long, después de vender, activar la compra
            order.buyOrderActive = true;
            order.sellOrderActive = false;
        } else if (this.mode === 'short') {
            // En modo short, después de comprar, activar la venta
            order.sellOrderActive = true;
            order.buyOrderActive = false;
        }
        
        this.gridExecutions.push({
            type: position.type === 'long' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
            price: currentPrice,
            size: position.size,
            profit: Math.abs(profit), // Siempre guardar como positivo
            time: new Date()
        });
        
        // Log de la ejecución para debugging
        console.log(`🔴 ${position.type.toUpperCase()} cerrado en nivel ${order.id}: ${currentPrice} USDT (precio anterior: ${this.lastPrice}) - Profit: ${Math.abs(profit).toFixed(2)} USDT`);
    }

    calculateTradeProfit(position, exitPrice) {
        let pnl = 0;
        
        if (position.type === 'long') {
            pnl = (exitPrice - position.entryPrice) * position.size;
        } else if (position.type === 'short') {
            pnl = (position.entryPrice - exitPrice) * position.size;
        }
        
        // Calcular fees de trading (0.1% por operación)
        const tradingFees = (position.entryPrice * position.size + exitPrice * position.size) * 0.001;
        
        // Calcular profit neto
        const netProfit = pnl - tradingFees;
        
        // Log detallado para debugging
        console.log(`📊 Cálculo de profit para ${position.type.toUpperCase()}:`);
        console.log(`   Precio entrada: ${position.entryPrice.toFixed(2)} USDT`);
        console.log(`   Precio salida: ${exitPrice.toFixed(2)} USDT`);
        console.log(`   Tamaño: ${position.size.toFixed(6)} BTC`);
        console.log(`   PnL bruto: ${pnl.toFixed(2)} USDT`);
        console.log(`   Fees: ${tradingFees.toFixed(2)} USDT`);
        console.log(`   Profit neto: ${netProfit.toFixed(2)} USDT`);
        
        // Asegurar que siempre devolvemos un valor positivo para el grid profit
        // Si es negativo, significa que fue una pérdida, pero para el grid profit solo contamos ganancias
        return Math.max(0, netProfit);
    }

    calculateUnrealizedPnL(currentPrice) {
        this.unrealizedPnl = 0;
        
        this.openPositions.forEach(position => {
            if (position.type === 'long') {
                this.unrealizedPnl += (currentPrice - position.entryPrice) * position.size;
            } else {
                this.unrealizedPnl += (position.entryPrice - currentPrice) * position.size;
            }
        });
    }

    updateChart() {
        if (!this.priceChart || this.priceHistory.length === 0) return;

        const labels = this.priceHistory.map(item => 
            item.time.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            })
        );
        
        const priceData = this.priceHistory.map(item => item.price);
        const profitData = this.profits.map(profit => profit);

        this.priceChart.data.labels = labels;
        this.priceChart.data.datasets[0].data = priceData;
        this.priceChart.data.datasets[1].data = profitData;
        this.priceChart.update('none');
    }

    updateDisplay() {
        const profitElement = document.getElementById(`totalProfit${this.suffix}`);
        const percentageElement = document.getElementById(`profitPercentage${this.suffix}`);
        const investment = parseFloat(document.getElementById(`investment${this.suffix}`).value);
        
        // Verificar que el gridProfit sea lógico
        this.validateGridProfit();
        
        const profitPercentage = (this.totalProfit / investment) * 100;
        const sign = this.totalProfit >= 0 ? '+' : '';
        
        if (profitElement) profitElement.textContent = `${sign}${this.totalProfit.toFixed(2)} USDT`;
        if (percentageElement) percentageElement.textContent = `(${sign}${profitPercentage.toFixed(2)}%)`;
        
        const profitDisplay = document.querySelector('#futures-grid .profit-display');
        if (profitDisplay) {
            if (this.totalProfit >= 0) {
                profitDisplay.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            } else {
                profitDisplay.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            }
        }

        const elements = {
            [`gridProfit${this.suffix}`]: `+${Math.abs(this.gridProfit).toFixed(2)} USDT`,
            [`unrealizedPnl${this.suffix}`]: `${this.unrealizedPnl >= 0 ? '+' : ''}${this.unrealizedPnl.toFixed(2)} USDT`,
            [`completedTrades${this.suffix}`]: this.completedTrades,
            [`totalExecutions${this.suffix}`]: this.gridExecutions.length
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        this.updateExecutionsList();
    }

    validateGridProfit() {
        // Asegurar que el gridProfit nunca sea negativo si hay trades completados
        if (this.completedTrades > 0 && this.gridProfit < 0) {
            console.warn('⚠️ Grid Profit negativo detectado, verificando cálculo...');
            // Recalcular gridProfit sumando solo las ganancias realizadas
            let recalculatedProfit = 0;
            this.gridExecutions.forEach(exec => {
                if (exec.profit !== 0) { // Solo trades cerrados tienen profit
                    recalculatedProfit += Math.abs(exec.profit);
                }
            });
            
            if (recalculatedProfit !== this.gridProfit) {
                console.log(`🔄 Grid Profit corregido: ${this.gridProfit.toFixed(2)} → ${recalculatedProfit.toFixed(2)} USDT`);
                this.gridProfit = recalculatedProfit;
            }
        }
        
        // Asegurar que gridProfit nunca sea negativo
        if (this.gridProfit < 0) {
            this.gridProfit = Math.abs(this.gridProfit);
        }
        
        // Verificar que el totalProfit sea consistente
        const expectedTotal = this.gridProfit + this.unrealizedPnl + this.totalFundingFees;
        if (Math.abs(this.totalProfit - expectedTotal) > 0.01) {
            console.warn('⚠️ Inconsistencia en totalProfit detectada, corrigiendo...');
            this.totalProfit = expectedTotal;
        }
    }

    updateExecutionsList() {
        const executionsList = document.getElementById(`executionsList${this.suffix}`);
        const executionsCard = document.getElementById(`executionsCard${this.suffix}`);
        const progressFill = document.getElementById(`progressFill${this.suffix}`);
        
        if (progressFill && this.historicalData && this.historicalData.length > 0) {
            const progress = (this.historicalIndex / this.historicalData.length) * 100;
            progressFill.style.width = `${progress}%`;
        }
        
        if (executionsList && executionsCard) {
            if (this.gridExecutions.length > 0) {
                executionsCard.style.display = 'block';
                
                const lastExecutions = this.gridExecutions.slice(-5).reverse();
                executionsList.innerHTML = lastExecutions.map(exec => `
                    <div class="execution-item">
                        <div>
                            <span class="execution-type ${exec.type.includes('LONG') ? 'execution-long' : 'execution-short'}">${exec.type}</span>
                            <span>${exec.size.toFixed(6)} BTC @ ${exec.price.toFixed(0)}</span>
                        </div>
                        <div style="color: ${exec.profit > 0 ? '#2ecc71' : '#bdc3c7'}; font-weight: bold;">
                            ${exec.profit !== 0 ? '+' + Math.abs(exec.profit).toFixed(2) + ' USDT' : '--'}
                        </div>
                    </div>
                `).join('');
            } else if (this.isRunning) {
                executionsCard.style.display = 'block';
                executionsList.innerHTML = '<div style="text-align: center; color: #bdc3c7; padding: 20px;">Esperando ejecuciones...</div>';
            } else {
                executionsCard.style.display = 'none';
            }
        }
    }

    stopBot() {
        this.isRunning = false;
        this.updateButtonStates();
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.fundingFeeInterval) {
            clearInterval(this.fundingFeeInterval);
            this.fundingFeeInterval = null;
        }
        
        const totalExecutions = this.gridExecutions.length;
        const finalProfit = this.totalProfit;
        
        this.showMessage(
            `Bot detenido - ${totalExecutions} ejecuciones, PnL: ${finalProfit >= 0 ? '+' : ''}${finalProfit.toFixed(2)} USDT`, 
            finalProfit >= 0 ? 'success' : 'error'
        );
    }

    updateButtonStates() {
        const startBtn = document.getElementById(`startBot${this.suffix}`);
        const stopBtn = document.getElementById(`stopBot${this.suffix}`);
        
        if (!startBtn || !stopBtn) return;
        
        const startIndicator = startBtn.querySelector('.status-indicator');
        const stopIndicator = stopBtn.querySelector('.status-indicator');

        if (this.isRunning) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            if (startIndicator) startIndicator.className = 'status-indicator status-active';
            if (stopIndicator) stopIndicator.className = 'status-indicator status-inactive';
            startBtn.innerHTML = '<span class="status-indicator status-active"></span> Bot Activo';
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            if (startIndicator) startIndicator.className = 'status-indicator status-inactive';
            if (stopIndicator) stopIndicator.className = 'status-indicator status-inactive';
            startBtn.innerHTML = '<span class="status-indicator status-inactive"></span> Iniciar Bot';
        }
    }

    showMessage(message, type) {
        const messageArea = document.getElementById(`messageArea${this.suffix}`);
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
            }, 5000);
        }
    }
}
