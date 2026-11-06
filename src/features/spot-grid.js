/**
 * Bot de grid trading en Spot (simulado).
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class SpotGridTradingBot {
    constructor() {
        this.isRunning = false;
        this.currentPrice = 0;
        this.priceHistory = [];
        this.profits = [];
        this.totalProfit = 0;
        this.gridProfit = 0;
        this.trendPnl = 0;
        this.exitPnl = 0;      // PnL de salidas por TP/SL (no es profit de rejilla)
        this.exitEvents = [];
        this.exited = false;   // true tras cerrar inventario por TP/SL
        this.completedRounds = 0;
        this.gridLevels = [];
        this.priceChart = null;
        this.updateInterval = null;
        this.simulationSpeed = 1000;
        this.historicalData = null;
        this.historicalIndex = 0;
        this.lastPrice = 0;
        this.gridExecutions = [];
        this.btcAllocation = 0;
        this.usdtAllocation = 0;
        this.btcQuantityPerGrid = 0;
        this.gridInterval = 0;
        this.suffix = '-spot';
        // Inventario y lotes para emparejar compras/ventas
        this.availableBaseQty = 0;
        this.availableQuote = 0;
        this.openLots = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeChart();
        this.setDefaultDates();
        this.updateGridCalculations();
        this.getCurrentPrice();
        this.updateAllocationDisplay();
        this.updateFeeDisplay();
    }

    setupEventListeners() {
        document.getElementById(`startBot${this.suffix}`).addEventListener('click', () => this.startBot());
        document.getElementById(`stopBot${this.suffix}`).addEventListener('click', () => this.stopBot());
        
        ['maxPrice', 'minPrice', 'gridCount', 'investment', 'gridPercent', 'tpPercent', 'slPercent', 'feePercent'].forEach(id => {
            const element = document.getElementById(`${id}${this.suffix}`);
            if (element) {
                element.addEventListener('input', () => this.updateGridCalculations());
            }
        });

        ['cryptoAllocation', 'stablecoinAllocation', 'investment'].forEach(id => {
            const element = document.getElementById(`${id}${this.suffix}`);
            if (element) {
                element.addEventListener('input', () => {
                    this.validateAllocation();
                    this.updateAllocationDisplay();
                    this.updateGridCalculations();
                });
            }
        });

        const symbolElement = document.getElementById(`symbol${this.suffix}`);
        if (symbolElement) {
            symbolElement.addEventListener('change', () => {
                this.getCurrentPrice();
                this.updateGridCalculations();
                this.updateAllocationDisplay();
            });
        }

        // Update fee display when fee changes
        const feeElement = document.getElementById(`feePercent${this.suffix}`);
        if (feeElement) {
            feeElement.addEventListener('input', () => this.updateFeeDisplay());
        }
    }

    validateAllocation() {
        const cryptoPercent = parseFloat(document.getElementById(`cryptoAllocation${this.suffix}`).value) || 0;
        const stablecoinPercent = parseFloat(document.getElementById(`stablecoinAllocation${this.suffix}`).value) || 0;
        const total = cryptoPercent + stablecoinPercent;
        
        const warningElement = document.getElementById(`allocationWarning${this.suffix}`);
        
        if (Math.abs(total - 100) > 0.01) {
            if (warningElement) {
                warningElement.style.display = 'block';
                warningElement.textContent = `⚠️ Total: ${total.toFixed(2)}% - Los porcentajes deben sumar 100%`;
            }
            return false;
        } else {
            if (warningElement) {
                warningElement.style.display = 'none';
            }
            return true;
        }
    }

    updateAllocationDisplay() {
        const totalInvestment = parseFloat(document.getElementById(`investment${this.suffix}`).value) || 0;
        const cryptoPercent = parseFloat(document.getElementById(`cryptoAllocation${this.suffix}`).value) || 0;
        const stablecoinPercent = parseFloat(document.getElementById(`stablecoinAllocation${this.suffix}`).value) || 0;
        
        const cryptoAmount = totalInvestment * (cryptoPercent / 100);
        const stablecoinAmount = totalInvestment * (stablecoinPercent / 100);
        
        const symbolElement = document.getElementById(`symbol${this.suffix}`);
        const symbol = symbolElement ? symbolElement.value.replace('USDT', '') : 'BTC';
        
        const cryptoDisplay = document.getElementById(`cryptoAllocationDisplay${this.suffix}`);
        const stablecoinDisplay = document.getElementById(`stablecoinAllocationDisplay${this.suffix}`);
        
        if (cryptoDisplay) {
            cryptoDisplay.textContent = `${symbol}: ${cryptoPercent}% ($${cryptoAmount.toFixed(2)})`;
        }
        if (stablecoinDisplay) {
            stablecoinDisplay.textContent = `USDT: ${stablecoinPercent}% ($${stablecoinAmount.toFixed(2)})`;
        }
    }

    updateFeeDisplay() {
        const feePercent = parseFloat(document.getElementById(`feePercent${this.suffix}`)?.value) || 0.20;
        const currentFeeElement = document.getElementById('currentFee-spot');
        if (currentFeeElement) {
            currentFeeElement.textContent = `${feePercent.toFixed(2)}%`;
        }
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
        const totalInvestment = parseFloat(document.getElementById(`investment${this.suffix}`).value);

        if (maxPrice <= minPrice) {
            this.showMessage('El precio máximo debe ser mayor al mínimo', 'error');
            return;
        }

        const cryptoAllocationPercent = parseFloat(document.getElementById(`cryptoAllocation${this.suffix}`).value) || 57.96;
        const stablecoinAllocationPercent = parseFloat(document.getElementById(`stablecoinAllocation${this.suffix}`).value) || 42.04;
        
        if (!this.validateAllocation()) {
            return;
        }
        
        const cryptoAllocation = totalInvestment * (cryptoAllocationPercent / 100);
        const stablecoinAllocation = totalInvestment * (stablecoinAllocationPercent / 100);
        
        const priceRange = maxPrice - minPrice;
        let gridInterval = priceRange / (gridCount - 1);
        const gridPercent = parseFloat(document.getElementById(`gridPercent${this.suffix}`).value) || 0;
        
        const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value) || ((maxPrice + minPrice) / 2);
        let cryptoQuantityPerGrid = cryptoAllocation / (gridCount * entryPrice);
        
        const rangeElement = document.getElementById(`tradingRange${this.suffix}`);
        const sizeElement = document.getElementById(`gridSize${this.suffix}`);
        const investmentElement = document.getElementById(`investmentPerGrid${this.suffix}`);
        
        if (rangeElement) {
            rangeElement.textContent = `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
        }
        if (sizeElement) {
            if (gridPercent > 0) {
                sizeElement.textContent = `${gridPercent.toFixed(2)}% por nivel (geométrico)`;
            } else {
                sizeElement.textContent = `${gridInterval.toFixed(2)} USDT por nivel`;
            }
        }
        if (investmentElement) {
            const symbol = document.getElementById(`symbol${this.suffix}`).value.replace('USDT', '');
            investmentElement.textContent = `${cryptoQuantityPerGrid.toFixed(6)} ${symbol} por rejilla`;
        }

        // Update grid percent display
        const gridPercentDisplayElement = document.getElementById(`gridPercentDisplay${this.suffix}`);
        if (gridPercentDisplayElement) {
            gridPercentDisplayElement.textContent = gridPercent > 0 ? `${gridPercent.toFixed(2)}%` : 'Auto';
        }
        
        // Construcción de niveles y cantidades por nivel (modelo Pionex):
        // - Órdenes de COMPRA por debajo del precio de entrada: repartir el USDT disponible por orden de compra
        // - Órdenes de VENTA por encima del precio de entrada: repartir la cantidad de crypto disponible por orden de venta
        // Niveles y reparto de capital: implementación única y testeada (grid-math.js)
        const levels = GridMath.computeLevels({ minPrice, maxPrice, gridCount, gridPercent });
        const orders = GridMath.allocateLevels(levels, {
            entryPrice,
            cryptoAllocation,
            stablecoinAllocation
        });

        this.gridLevels = orders.map(order => ({
            price: order.price,
            cryptoQuantity: order.qty,
            gridInterval
        }));

        const buyOrdersCount = orders.filter(order => order.side === 'buy').length;
        const buyUsdtPerOrder = buyOrdersCount > 0 ? stablecoinAllocation / buyOrdersCount : 0;

        this.cryptoAllocation = cryptoAllocation;
        this.usdtAllocation = stablecoinAllocation;
        this.cryptoQuantityPerGrid = cryptoQuantityPerGrid;
        this.gridInterval = gridInterval;

        // Estimar ganancia por rejilla (neto) usando gridPercent o intervalo con fee editable
        let est = 0;
        let grossPct = 0;
        if (gridPercent > 0) {
            grossPct = gridPercent;
            est = buyUsdtPerOrder * (gridPercent / 100);
        } else {
            grossPct = entryPrice > 0 ? (gridInterval / entryPrice) * 100 : 0;
            est = (buyUsdtPerOrder || (entryPrice * cryptoQuantityPerGrid)) * (grossPct / 100);
        }
        const perGridEl = document.getElementById(`gridProfitPerGrid${this.suffix}`);
        if (perGridEl) {
            if (gridPercent > 0) {
                perGridEl.textContent = `${est >= 0 ? '+' : ''}${est.toFixed(2)} USDT (~${gridPercent.toFixed(2)}%)`;
            } else {
                perGridEl.textContent = `${est >= 0 ? '+' : ''}${est.toFixed(2)} USDT`;
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
            
            if (!this.isRunning) {
                const entryPriceElement = document.getElementById(`entryPrice${this.suffix}`);
                if (entryPriceElement) {
                    entryPriceElement.value = this.currentPrice;
                }
            }
        } catch (error) {
            this.updateConnectionStatus(false);
            this.showMessage('Error al obtener precio actual: ' + error.message, 'error');
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
                    label: 'Ganancias',
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
            this.validateInputs();
            this.showMessage('Cargando datos históricos...', 'success');
            
            await this.loadHistoricalData();
            
            this.isRunning = true;
            this.updateButtonStates();
            this.resetSimulation();
            this.startHistoricalSimulation();
            
            this.showMessage(`Bot iniciado - Simulando ${this.historicalData.length} períodos históricos`, 'success');
        } catch (error) {
            this.showMessage('Error al iniciar bot: ' + error.message, 'error');
            this.isRunning = false;
            this.updateButtonStates();
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
            // Avanzar al siguiente
            from = lastOpenTime + 1;
            // Seguridad: evitar bucles infinitos
            if (batch.length < limit) break;
        }
        return all;
    }

    startHistoricalSimulation() {
        this.simulationSpeed = 200;
        this.updateInterval = setInterval(() => {
            if (!this.isRunning) return;

            try {
                this.simulateGridTrading();
                
                if (this.historicalIndex % 5 === 0) {
                    this.updateChart();
                    this.updateDisplay();
                }
            } catch (error) {
                console.error('Simulation error:', error);
                this.showMessage('Error en simulación: ' + error.message, 'error');
            }
        }, this.simulationSpeed);
    }

    stopBot() {
        this.isRunning = false;
        this.updateButtonStates();
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        const totalExecutions = this.gridExecutions.length;
        const finalProfit = this.totalProfit;
        
        this.showMessage(
            `Bot detenido - ${totalExecutions} ejecuciones, Ganancia: ${finalProfit >= 0 ? '+' : ''}${finalProfit.toFixed(2)} USDT`, 
            'error'
        );
    }

    validateInputs() {
        const maxPrice = parseFloat(document.getElementById(`maxPrice${this.suffix}`).value);
        const minPrice = parseFloat(document.getElementById(`minPrice${this.suffix}`).value);
        const investment = parseFloat(document.getElementById(`investment${this.suffix}`).value);
        const gridCount = parseInt(document.getElementById(`gridCount${this.suffix}`).value);

        if (maxPrice <= minPrice) throw new Error('Precio máximo debe ser mayor al mínimo');
        if (investment < 10) throw new Error('Inversión mínima: 10 USDT');
        if (gridCount < 2) throw new Error('Mínimo 2 rejillas');
        if (gridCount > 150) throw new Error('Máximo 150 rejillas');
        if (!this.validateAllocation()) throw new Error('Los porcentajes de asignación deben sumar 100%');
    }

    resetSimulation() {
        this.totalProfit = 0;
        this.gridProfit = 0;
        this.trendPnl = 0;
        this.exitPnl = 0;
        this.exitEvents = [];
        this.exited = false;
        this.completedRounds = 0;
        this.priceHistory = [];
        this.profits = [];
        this.gridExecutions = [];
        this.lastPrice = 0;
        this.historicalIndex = 0;
        // Inicializar inventarios según asignación
        const totalInvestment = parseFloat(document.getElementById(`investment${this.suffix}`).value) || 0;
        const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value) || this.currentPrice || 0;
        const cryptoAllocationPercent = parseFloat(document.getElementById(`cryptoAllocation${this.suffix}`).value) || 57.96;
        const stablecoinAllocationPercent = parseFloat(document.getElementById(`stablecoinAllocation${this.suffix}`).value) || 42.04;
        const cryptoAllocation = totalInvestment * (cryptoAllocationPercent / 100);
        const stablecoinAllocation = totalInvestment * (stablecoinAllocationPercent / 100);
        this.availableBaseQty = entryPrice > 0 ? (cryptoAllocation / entryPrice) : 0;
        this.availableQuote = stablecoinAllocation;
        this.openLots = [];
        this.updateDisplay();
        
        if (this.priceChart) {
            this.priceChart.data.labels = [];
            this.priceChart.data.datasets[0].data = [];
            this.priceChart.data.datasets[1].data = [];
            this.priceChart.update();
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
            
            const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value);
            const totalInvestment = parseFloat(document.getElementById(`investment${this.suffix}`).value);
            const cryptoAllocationPercent = parseFloat(document.getElementById(`cryptoAllocation${this.suffix}`).value) || 57.96;
            const priceChange = (simulatedPrice - entryPrice) / entryPrice;
            
            const cryptoAllocation = totalInvestment * (cryptoAllocationPercent / 100);
            if (!this.exited) {
                this.trendPnl = cryptoAllocation * priceChange;
            }
            
            // Check Take Profit and Stop Loss
            this.checkTakeProfitStopLoss(simulatedPrice, entryPrice);
            
            this.totalProfit = this.gridProfit + this.trendPnl + this.exitPnl;
            this.profits.push(this.totalProfit);
            
            this.historicalIndex++;
            
            const currentPriceElement = document.getElementById(`currentPrice${this.suffix}`);
            if (currentPriceElement) {
                currentPriceElement.textContent = 
                    `${simulatedPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT`;
            }
        } else {
            // Al finalizar, si el rango llega a "hoy", usar precio actual como último punto
            try {
                const symbolElement = document.getElementById(`symbol${this.suffix}`);
                const symbol = symbolElement ? symbolElement.value : 'BTCUSDT';
                const now = Date.now();
                if (this.selectedEndTime && (now - this.selectedEndTime) < (24 * 60 * 60 * 1000)) {
                    const resp = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
                    const data = await resp.json();
                    const livePrice = parseFloat(data.price);
                    if (!isNaN(livePrice)) {
                        // procesar último cruce hasta precio actual
                        this.processGridOrders(livePrice);
                        const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value);
                        const totalInvestment = parseFloat(document.getElementById(`investment${this.suffix}`).value);
                        const cryptoAllocationPercent = parseFloat(document.getElementById(`cryptoAllocation${this.suffix}`).value) || 57.96;
                        const cryptoAllocation = totalInvestment * (cryptoAllocationPercent / 100);
                        const priceChange = (livePrice - entryPrice) / entryPrice;
                        if (!this.exited) {
                this.trendPnl = cryptoAllocation * priceChange;
            }
                        this.totalProfit = this.gridProfit + this.trendPnl + this.exitPnl;
                        this.priceHistory.push({ time: new Date(now), price: livePrice });
                        const currentPriceElement = document.getElementById(`currentPrice${this.suffix}`);
                        if (currentPriceElement) {
                            currentPriceElement.textContent = `${livePrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT`;
                        }
                        this.updateChart();
                        this.updateDisplay();
                    }
                }
            } catch (e) {
                // silencioso
            }
            this.stopBot();
            this.showMessage('Simulación completada con datos históricos', 'success');
        }
    }

    processGridOrders(currentPrice) {
        // Tras un cierre por TP/SL no se siguen abriendo niveles
        if (this.exited) return;

        if (this.lastPrice === 0) {
            this.lastPrice = currentPrice;
            return;
        }

        this.gridLevels.forEach((level, index) => {
            const crossedUp = this.lastPrice < level.price && currentPrice >= level.price;
            const crossedDown = this.lastPrice > level.price && currentPrice <= level.price;
            
            if (crossedUp) {
                this.executeSellOrder(level, currentPrice);
            }
            
            if (crossedDown) {
                this.executeBuyOrder(level, currentPrice);
            }
        });

        // TP/SL globales respecto al precio de entrada
        const tpPct = parseFloat(document.getElementById(`tpPercent${this.suffix}`)?.value) || 0;
        const slPct = parseFloat(document.getElementById(`slPercent${this.suffix}`)?.value) || 0;
        const entryPrice = parseFloat(document.getElementById(`entryPrice${this.suffix}`).value) || 0;
        const hit = GridMath.hitTakeProfitStopLoss({
            entryPrice,
            currentPrice,
            tpPercent: tpPct,
            slPercent: slPct
        });

        if (hit) {
            // La salida se cierra contra el coste real y se contabiliza aparte:
            // antes se vendía como si fuera un nivel más de la rejilla.
            const exit = this.closeInventoryAt(currentPrice, hit === 'tp' ? 'take-profit' : 'stop-loss');
            if (exit) {
                const sign = exit.pnl >= 0 ? '+' : '';
                this.showMessage(
                    hit === 'tp'
                        ? `🎯 Take Profit: salida a ${currentPrice.toFixed(2)} → ${sign}${exit.pnl.toFixed(2)} USDT`
                        : `🛑 Stop Loss: salida a ${currentPrice.toFixed(2)} → ${sign}${exit.pnl.toFixed(2)} USDT`,
                    hit === 'tp' ? 'success' : 'error'
                );
            }
        }

        this.lastPrice = currentPrice;
    }

    checkTakeProfitStopLoss(currentPrice, entryPrice) {
        const tpPercent = parseFloat(document.getElementById(`tpPercent${this.suffix}`)?.value) || 0;
        const slPercent = parseFloat(document.getElementById(`slPercent${this.suffix}`)?.value) || 0;
        
        if (tpPercent > 0 || slPercent > 0) {
            const priceChange = (currentPrice - entryPrice) / entryPrice;
            
            // Check Take Profit
            if (tpPercent > 0 && priceChange >= tpPercent / 100) {
                this.showMessage(`🎯 Take Profit alcanzado: +${(priceChange * 100).toFixed(2)}%`, 'success');
                this.stopBot();
                return;
            }
            
            // Check Stop Loss
            if (slPercent > 0 && priceChange <= -slPercent / 100) {
                this.showMessage(`🛑 Stop Loss alcanzado: ${(priceChange * 100).toFixed(2)}%`, 'error');
                this.stopBot();
                return;
            }
        }
    }

    /**
     * Cierra todo el inventario a precio de mercado (TP/SL).
     * El resultado va a exitPnl, no a gridProfit: no es el cruce de un nivel.
     */
    closeInventoryAt(price, reason = 'exit') {
        const qty = this.availableBaseQty;
        if (!(qty > 0)) return null;

        const feePercent = parseFloat(document.getElementById(`feePercent${this.suffix}`)?.value) || 0.20;
        const entryPrice = this.getInitialCryptoPrice();

        // Coste real: lotes abiertos (precio + comisión) + inventario inicial a entrada
        let lotsQty = 0;
        let lotsCost = 0;
        for (const lot of this.openLots) {
            lotsQty += lot.qty;
            lotsCost += lot.qty * lot.price + lot.fee;
        }
        const initialQty = Math.max(0, qty - lotsQty);
        const costBasis = lotsCost + initialQty * entryPrice;

        const exit = GridMath.realizeExit({ qty, price, feePct: feePercent, costBasis });

        this.availableBaseQty = 0;
        this.availableQuote += exit.proceeds;
        this.openLots = [];
        this.exitPnl += exit.pnl;
        this.exitEvents.push({ reason, ...exit, time: new Date() });
        this.exited = true;

        const symbol = (document.getElementById(`symbol${this.suffix}`)?.value || '').replace('USDT', '');
        this.gridExecutions.push({
            type: 'EXIT',
            reason,
            price: exit.price,
            cryptoQuantity: exit.qty,
            usdtAmount: exit.proceeds,
            fee: exit.fee,
            profit: exit.pnl,
            time: new Date(),
            symbol
        });

        this.totalProfit = this.gridProfit + this.trendPnl + this.exitPnl;
        return exit;
    }

    executeSellOrder(level, currentPrice) {
        const sellPrice = level.price;
        const cryptoQuantity = level.cryptoQuantity;
        const usdtReceived = sellPrice * cryptoQuantity;
        
        const feePct = (parseFloat(document.getElementById(`feePercent${this.suffix}`)?.value) || 0.20) / 100;
        const tradingFee = usdtReceived * feePct;
        const netUsdtReceived = usdtReceived - tradingFee;
        
        // Verificar inventario para vender
        if (this.availableBaseQty < cryptoQuantity) {
            return; // no hay inventario suficiente, no vender
        }

        const matchingBuy = this.findMatchingBuyOrder(level.price, cryptoQuantity);
        let gridProfit = 0;
        
        if (matchingBuy) {
            gridProfit = (sellPrice - matchingBuy.price) * cryptoQuantity - tradingFee - matchingBuy.fee;
            this.completedRounds++;
        } else {
            gridProfit = netUsdtReceived - (cryptoQuantity * this.getInitialCryptoPrice());
        }
        
        this.gridProfit += gridProfit;
        // Actualizar inventarios: vendimos crypto, recibimos USDT
        this.availableBaseQty -= cryptoQuantity;
        this.availableQuote += netUsdtReceived;
        
        const symbol = document.getElementById(`symbol${this.suffix}`).value.replace('USDT', '');
        
        this.gridExecutions.push({
            type: 'SELL',
            price: sellPrice,
            cryptoQuantity: cryptoQuantity,
            usdtAmount: netUsdtReceived,
            fee: tradingFee,
            profit: gridProfit,
            time: new Date(),
            symbol: symbol
        });
    }

    executeBuyOrder(level, currentPrice) {
        const buyPrice = level.price;
        const cryptoQuantity = level.cryptoQuantity;
        const usdtSpent = buyPrice * cryptoQuantity;
        
        const feePct = (parseFloat(document.getElementById(`feePercent${this.suffix}`)?.value) || 0.20) / 100;
        const tradingFee = usdtSpent * feePct;
        const totalUsdtCost = usdtSpent + tradingFee;
        // Verificar USDT disponible
        if (this.availableQuote < totalUsdtCost) {
            return; // no hay USDT suficiente, no comprar
        }

        const symbol = document.getElementById(`symbol${this.suffix}`).value.replace('USDT', '');
        
        this.gridExecutions.push({
            type: 'BUY',
            price: buyPrice,
            cryptoQuantity: cryptoQuantity,
            usdtAmount: totalUsdtCost,
            fee: tradingFee,
            profit: 0,
            time: new Date(),
            symbol: symbol
        });

        // Guardar lote abierto para emparejar futuras ventas
        this.openLots.push({ price: buyPrice, qty: cryptoQuantity, fee: tradingFee });
        // Actualizar inventarios: gastamos USDT y aumentamos crypto
        this.availableQuote -= totalUsdtCost;
        this.availableBaseQty += cryptoQuantity;
    }

    findMatchingBuyOrder(sellPrice, quantity) {
        // Usar el lote más reciente por debajo del precio de venta
        for (let i = this.openLots.length - 1; i >= 0; i--) {
            const lot = this.openLots[i];
            if (lot.qty > 0 && lot.price <= sellPrice) {
                const originalQty = lot.qty;
                const consume = Math.min(originalQty, quantity);
                lot.qty = originalQty - consume;
                if (lot.qty <= 0) {
                    this.openLots.splice(i, 1);
                }
                const feeProportion = originalQty > 0 ? lot.fee * (consume / originalQty) : 0;
                return { price: lot.price, fee: feeProportion };
            }
        }
        return null;
    }

    getInitialCryptoPrice() {
        return parseFloat(document.getElementById(`entryPrice${this.suffix}`).value) || this.currentPrice;
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
        
        const profitPercentage = (this.totalProfit / investment) * 100;
        const sign = this.totalProfit >= 0 ? '+' : '';
        
        if (profitElement) profitElement.textContent = `${sign}${this.totalProfit.toFixed(2)} USDT`;
        if (percentageElement) percentageElement.textContent = `(${sign}${profitPercentage.toFixed(2)}%)`;
        
        // Calculate completed rounds more accurately
        this.calculateCompletedRounds();
        
        const profitDisplay = document.querySelector('#spot-grid .profit-display');
        if (profitDisplay) {
            if (this.totalProfit >= 0) {
                profitDisplay.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
            } else {
                profitDisplay.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            }
        }

        const elements = {
            [`gridProfit${this.suffix}`]: `+${this.gridProfit.toFixed(2)} USDT`,
            [`trendPnl${this.suffix}`]: `${this.trendPnl >= 0 ? '+' : ''}${this.trendPnl.toFixed(2)} USDT`,
            [`completedRounds${this.suffix}`]: this.completedRounds,
            [`totalExecutions${this.suffix}`]: this.gridExecutions.length,
            [`botStatus${this.suffix}`]: this.isRunning ? 'Activo' : 'Inactivo'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        this.updateExecutionsList();
    }

    calculateCompletedRounds() {
        // Count complete buy-sell cycles
        const buyOrders = this.gridExecutions.filter(exec => exec.type === 'BUY');
        const sellOrders = this.gridExecutions.filter(exec => exec.type === 'SELL');
        
        // A round is complete when we have both buy and sell orders
        // We'll count the minimum of buy and sell orders as completed rounds
        const completedRounds = Math.min(buyOrders.length, sellOrders.length);
        
        // Update the display
        const completedRoundsElement = document.getElementById(`completedRounds${this.suffix}`);
        if (completedRoundsElement) {
            completedRoundsElement.textContent = completedRounds;
        }
        
        // Also update the total executions
        const totalExecutionsElement = document.getElementById(`totalExecutions${this.suffix}`);
        if (totalExecutionsElement) {
            totalExecutionsElement.textContent = this.gridExecutions.length;
        }
        // El resumen inferior usa otro id (antes duplicaba el de la tarjeta y nunca se actualizaba)
        const totalExecutionsSummary = document.getElementById(`totalExecutionsSummary${this.suffix}`);
        if (totalExecutionsSummary) {
            totalExecutionsSummary.textContent = this.gridExecutions.length;
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
                            <span class="execution-type ${exec.type === 'BUY' ? 'execution-buy' : 'execution-sell'}">${exec.type}</span>
                            <span>${exec.cryptoQuantity.toFixed(6)} ${exec.symbol} @ ${exec.price.toFixed(0)}</span>
                        </div>
                        <div style="color: ${exec.profit > 0 ? '#2ecc71' : '#bdc3c7'}; font-weight: bold;">
                            ${exec.profit > 0 ? '+' : ''}${exec.profit.toFixed(2)} USDT
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
