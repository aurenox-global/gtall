/**
 * Trading manual Futuros (simulado).
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class ManualFuturesTrader {
    constructor() {
        this.currentPrice = 0;
        this.availableMargin = 0;
        this.usedMargin = 0;
        this.unrealizedPnl = 0;
        this.realizedPnl = 0;
        this.fundingFees = 0;
        this.totalTrades = 0;
        this.capitalNet = 0;
        this.activePositions = [];
        this.tradeHistory = [];
        this.chart = null;
        this.priceHistory = [];
        this.orderType = 'long';
        this.orderMode = 'limit';
        this.leverage = 10;
        this.symbol = 'BTCUSDT';
        
        this.init();
    }

    init() {
        this.loadData(); // Load saved data first
        this.setupEventListeners();
        this.initializeChart();
        this.getCurrentPrice();
        this.updateDisplay();
        this.startFundingFeeTimer();
        this.startPriceUpdates();
        this.setupAutoSave(); // Setup auto-save
    }

    startPriceUpdates() {
        // Update price every 2 seconds
        setInterval(() => {
            this.getCurrentPrice();
            this.checkStopLossTakeProfit();
        }, 2000);
    }

    setupEventListeners() {
        // Leverage selector
        document.querySelectorAll('#manual-futures .leverage-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#manual-futures .leverage-btn').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                this.leverage = parseInt(btn.dataset.leverage);
                this.calculatePositionSize();
            });
        });

        // Order type selector (Long/Short)
        document.querySelectorAll('#manual-futures .order-type-btn[data-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#manual-futures .order-type-btn[data-type]').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                this.orderType = btn.dataset.type;
            });
        });

        // Order mode selector (Market/Limit)
        document.querySelectorAll('#manual-futures .order-type-btn[data-order]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#manual-futures .order-type-btn[data-order]').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                this.orderMode = btn.dataset.order;
                this.updateOrderForm();
            });
        });

        // Symbol change
        document.getElementById('symbol-manual-futures').addEventListener('change', () => {
            this.symbol = document.getElementById('symbol-manual-futures').value;
            this.getCurrentPrice();
        });

        // Price/Margin changes
        document.getElementById('orderPrice-manual-futures').addEventListener('input', () => {
            this.calculatePositionSize();
        });
        
        document.getElementById('orderMargin-manual-futures').addEventListener('input', () => {
            this.calculatePositionSize();
        });

        // Execute buttons
        document.getElementById('executeLong-manual-futures').addEventListener('click', () => {
            this.executeTrade('long');
        });
        
        document.getElementById('executeShort-manual-futures').addEventListener('click', () => {
            this.executeTrade('short');
        });

        // Balance editor button
        document.getElementById('editBalanceFutures').addEventListener('click', () => {
            this.editBalance();
        });

        const addCapitalBtn = document.getElementById('addCapitalFutures');
        if (addCapitalBtn) {
            addCapitalBtn.addEventListener('click', () => {
                this.updateCapital(true);
            });
        }

        const removeCapitalBtn = document.getElementById('removeCapitalFutures');
        if (removeCapitalBtn) {
            removeCapitalBtn.addEventListener('click', () => {
                this.updateCapital(false);
            });
        }
    }

    async getCurrentPrice() {
        try {
            const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${this.symbol}`);
            const data = await response.json();
            this.currentPrice = parseFloat(data.price);
            
            // Update connection status
            this.updateConnectionStatus(true);
            
            // Update current price display
            const priceDisplay = document.getElementById('currentPriceDisplay-manual-futures');
            if (priceDisplay) {
                priceDisplay.textContent = this.currentPrice.toLocaleString();
            }
            
            // Update price in form
            if (this.orderMode === 'market') {
                document.getElementById('orderPrice-manual-futures').value = this.currentPrice;
            }
            
            this.calculatePositionSize();
            this.updatePositionValues();
            this.updateDisplay(); // Update display when price changes
            
        } catch (error) {
            this.updateConnectionStatus(false);
            this.showMessage('Error al obtener precio: ' + error.message, 'error');
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (connected) {
                statusElement.innerHTML = '🟢 Conectado';
                statusElement.style.color = '#2ecc71';
            } else {
                statusElement.innerHTML = '🔴 Error de Conexión';
                statusElement.style.color = '#e74c3c';
            }
        }
    }

    calculatePositionSize() {
        const price = parseFloat(document.getElementById('orderPrice-manual-futures').value) || 0;
        const margin = parseFloat(document.getElementById('orderMargin-manual-futures').value) || 0;
        const positionSize = price > 0 ? (margin * this.leverage) / price : 0;
        
        document.getElementById('orderSize-manual-futures').value = positionSize.toFixed(3);
        
        // Update margin info
        const liquidationPrice = this.calculateLiquidationPrice(price, this.orderType);
        const marginInfo = document.getElementById('marginInfo-manual-futures');
        if (marginInfo) {
            marginInfo.innerHTML = `
                💼 Margen Inicial: $${margin} | Posición: $${(margin * this.leverage).toFixed(0)} | 
                Liquidación: ~$${liquidationPrice.toFixed(0)}
            `;
        }
    }

    calculateLiquidationPrice(entryPrice, type) {
        const maintenanceMarginRate = 0.005; // 0.5%
        const fees = 0.001; // 0.1%
        
        if (type === 'long') {
            return entryPrice * (1 - (1/this.leverage) + maintenanceMarginRate + fees);
        } else {
            return entryPrice * (1 + (1/this.leverage) + maintenanceMarginRate + fees);
        }
    }

    updateOrderForm() {
        const priceInput = document.getElementById('orderPrice-manual-futures');
        if (this.orderMode === 'market') {
            priceInput.value = this.currentPrice;
            priceInput.disabled = true;
        } else {
            priceInput.disabled = false;
        }
    }

    executeTrade(type) {
        const price = parseFloat(document.getElementById('orderPrice-manual-futures').value) || 0;
        const margin = parseFloat(document.getElementById('orderMargin-manual-futures').value) || 0;
        const size = parseFloat(document.getElementById('orderSize-manual-futures').value) || 0;
        const positionValue = margin * this.leverage;
        const fee = positionValue * 0.001; // 0.1% fee
        const stopLoss = parseFloat(document.getElementById('stopLoss-manual-futures').value) || 0;
        const takeProfit = parseFloat(document.getElementById('takeProfit-manual-futures').value) || 0;

        if (price <= 0 || margin <= 0 || size <= 0) {
            this.showMessage('Precio y margen deben ser mayores a 0', 'error');
            return;
        }

        if (this.availableMargin < margin + fee) {
            this.showMessage('Margen insuficiente para abrir la posición', 'error');
            return;
        }
        
        // Execute futures order
        this.availableMargin -= (margin + fee);
        this.usedMargin += margin;
        
        // Create position with stop loss and take profit
        const position = {
            id: Date.now(),
            type: type,
            symbol: this.symbol,
            entryPrice: price,
            size: size,
            margin: margin,
            leverage: this.leverage,
            positionValue: positionValue,
            fee: fee,
            liquidationPrice: this.calculateLiquidationPrice(price, type),
            stopLoss: stopLoss > 0 ? (type === 'long' ? price * (1 - stopLoss / 100) : price * (1 + stopLoss / 100)) : null,
            takeProfit: takeProfit > 0 ? (type === 'long' ? price * (1 + takeProfit / 100) : price * (1 - takeProfit / 100)) : null,
            timestamp: new Date()
        };
        
        this.activePositions.push(position);
        this.totalTrades++;
        
        const typeText = type === 'long' ? 'LONG' : 'SHORT';
        this.showMessage(`Posición ${typeText} abierta: ${size.toFixed(3)} ${this.symbol.replace('USDT', '')} a $${price}`, 'success');
        
        this.updateDisplay();
        this.checkStopLossTakeProfit();
        this.saveData(); // Save after opening position
    }

    closePosition(positionId, reason = 'manual') {
        const positionIndex = this.activePositions.findIndex(p => p.id === positionId);
        if (positionIndex === -1) return;
        
        const position = this.activePositions[positionIndex];
        const pnl = this.calculatePositionPnl(position, this.currentPrice);
        
        // Return margin and add/subtract PnL
        this.availableMargin += position.margin;
        this.usedMargin -= position.margin;
        this.realizedPnl += pnl;
        
        // Remove position
        this.activePositions.splice(positionIndex, 1);
        
        // Record in history
        this.tradeHistory.push({
            type: 'close',
            symbol: position.symbol.replace('USDT', ''),
            positionType: position.type,
            size: position.size,
            entryPrice: position.entryPrice,
            exitPrice: this.currentPrice,
            pnl: pnl,
            reason: reason,
            timestamp: new Date()
        });
        
        const reasonText = reason === 'liquidation' ? 'Liquidada' : 
                          reason === 'stop-loss' ? 'Stop Loss' :
                          reason === 'take-profit' ? 'Take Profit' : 'Cerrada';
        
        this.showMessage(`Posición ${reasonText}: PnL ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, 
                        pnl >= 0 ? 'success' : 'error');
        
        this.updateDisplay();
        this.saveData(); // Save after closing position
    }

    calculatePositionPnl(position, currentPrice) {
        if (position.type === 'long') {
            return (currentPrice - position.entryPrice) * position.size - position.fee;
        } else {
            return (position.entryPrice - currentPrice) * position.size - position.fee;
        }
    }

    checkStopLossTakeProfit() {
        // Use a copy of the array to avoid issues with concurrent modification
        const positionsToCheck = [...this.activePositions];
        
        positionsToCheck.forEach(position => {
            // Check liquidation
            if ((position.type === 'long' && this.currentPrice <= position.liquidationPrice) ||
                (position.type === 'short' && this.currentPrice >= position.liquidationPrice)) {
                this.closePosition(position.id, 'liquidation');
                return;
            }
            
            // Check stop loss
            if (position.stopLoss) {
                if ((position.type === 'long' && this.currentPrice <= position.stopLoss) ||
                    (position.type === 'short' && this.currentPrice >= position.stopLoss)) {
                    this.closePosition(position.id, 'stop-loss');
                    return;
                }
            }
            
            // Check take profit
            if (position.takeProfit) {
                if ((position.type === 'long' && this.currentPrice >= position.takeProfit) ||
                    (position.type === 'short' && this.currentPrice <= position.takeProfit)) {
                    this.closePosition(position.id, 'take-profit');
                    return;
                }
            }
        });
    }

    updatePositionValues() {
        this.unrealizedPnl = 0;
        this.activePositions.forEach(position => {
            const pnl = this.calculatePositionPnl(position, this.currentPrice);
            position.unrealizedPnl = pnl;
            this.unrealizedPnl += pnl;
        });
    }

    startFundingFeeTimer() {
        // Simulate funding fees every 30 seconds (normally 8 hours)
        setInterval(() => {
            if (this.activePositions.length > 0) {
                // Random funding rate between -0.01% to +0.01%
                const fundingRate = (Math.random() - 0.5) * 0.0002;
                
                this.activePositions.forEach(position => {
                    const fundingFee = position.positionValue * Math.abs(fundingRate);
                    this.fundingFees += fundingFee * (fundingRate > 0 ? -1 : 1);
                });
                
                this.updateDisplay();
            }
        }, 30000);
    }

    updateDisplay() {
        // Update balances
        document.getElementById('futuresMargin').textContent = `${this.availableMargin.toFixed(2)} USDT`;
        document.getElementById('availableMargin-manual-futures').textContent = `${this.availableMargin.toFixed(2)} USDT`;
        document.getElementById('usedMargin-manual-futures').textContent = `${this.usedMargin.toFixed(2)} USDT`;

        const capitalNetElement = document.getElementById('futuresCapitalNet');
        if (capitalNetElement) {
            capitalNetElement.textContent = `Capital neto: ${this.capitalNet.toFixed(2)} USDT`;
        }
        
        // Update PnL
        document.getElementById('unrealizedPnl-manual-futures').textContent = 
            `${this.unrealizedPnl >= 0 ? '+' : ''}${this.unrealizedPnl.toFixed(2)} USDT`;
        document.getElementById('realizedPnl-manual-futures').textContent = 
            `${this.realizedPnl >= 0 ? '+' : ''}${this.realizedPnl.toFixed(2)} USDT`;
        document.getElementById('fundingFees-manual-futures').textContent = 
            `${this.fundingFees >= 0 ? '+' : ''}${this.fundingFees.toFixed(2)} USDT`;
            
        document.getElementById('totalTrades-manual-futures').textContent = this.totalTrades;
        
        // Update active positions display
        this.updateActivePositions();
    }

    updateActivePositions() {
        const container = document.getElementById('activePositions-manual-futures');
        
        if (this.activePositions.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #bdc3c7; padding: 20px;">No hay posiciones activas</div>';
            return;
        }
        
        container.innerHTML = this.activePositions.map(position => {
            const pnl = this.calculatePositionPnl(position, this.currentPrice);
            const pnlPercent = (pnl / position.margin) * 100;
            const pnlClass = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            
            // Check if close to liquidation
            const liquidationDistance = Math.abs(this.currentPrice - position.liquidationPrice) / this.currentPrice;
            const liquidationRisk = liquidationDistance < 0.1 ? 'liquidation-risk' : '';
            
            return `
                <div class="position-item ${liquidationRisk}">
                    <div>
                        <strong>${position.type.toUpperCase()} ${position.symbol.replace('USDT', '')}</strong><br>
                        ${position.size.toFixed(3)} @ $${position.entryPrice.toFixed(2)} | ${position.leverage}x<br>
                        <small>Liq: $${position.liquidationPrice.toFixed(0)}</small>
                    </div>
                    <div class="${pnlClass}">
                        ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}<br>
                        (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)
                        <br><button onclick="window.manualFuturesTrader.closePosition(${position.id})" 
                                  style="font-size: 10px; padding: 2px 6px; margin-top: 4px; background: #e74c3c; border: none; border-radius: 3px; color: white; cursor: pointer;">
                            Cerrar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    initializeChart() {
        const ctx = document.getElementById('futuresChart-manual');
        if (!ctx) return;
        
        this.chart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Precio',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1
                }, {
                    label: 'PnL Unrealized',
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
                        labels: { color: '#ecf0f1' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#bdc3c7' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
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

        // Update chart periodically
        setInterval(() => {
            this.updateChart();
        }, 5000);
    }

    updateChart() {
        if (!this.chart) return;

        this.priceHistory.push({
            time: new Date(),
            price: this.currentPrice,
            pnl: this.unrealizedPnl
        });

        // Keep only last 20 points amag
        if (this.priceHistory.length > 20) {
            this.priceHistory.shift();
        }

        const labels = this.priceHistory.map(item => 
            item.time.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        );
        
        const priceData = this.priceHistory.map(item => item.price);
        const pnlData = this.priceHistory.map(item => item.pnl);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = priceData;
        this.chart.data.datasets[1].data = pnlData;
        this.chart.update('none');
    }

    editBalance() {
        const totalBalance = this.availableMargin + this.usedMargin;
        const newBalance = prompt(`Ingresa el nuevo balance total (USDT):\n\nBalance actual: ${totalBalance.toFixed(2)} USDT\nDisponible: ${this.availableMargin.toFixed(2)} USDT\nUsado: ${this.usedMargin.toFixed(2)} USDT`, totalBalance.toFixed(2));
        
        if (newBalance !== null && !isNaN(newBalance) && parseFloat(newBalance) >= 0) {
            const balanceValue = parseFloat(newBalance);
            
            if (balanceValue < this.usedMargin) {
                this.showMessage(`El nuevo balance no puede ser menor al margen usado (${this.usedMargin.toFixed(2)} USDT)`, 'error');
                return;
            }
            
            // Update balances
            this.availableMargin = balanceValue - this.usedMargin;
            this.capitalNet = balanceValue;
            
            this.updateDisplay();
            this.saveData(); // Save after balance edit
            this.showMessage(`Balance actualizado a ${balanceValue.toFixed(2)} USDT`, 'success');
        } else if (newBalance !== null) {
            this.showMessage('Por favor ingresa un valor válido', 'error');
        }
    }

    updateCapital(isAdd) {
        const capitalInput = document.getElementById('futuresCapitalAmount');
        if (!capitalInput) return;

        const amount = parseFloat(capitalInput.value);
        if (!amount || amount <= 0) {
            this.showMessage('Ingresa un monto válido', 'error');
            return;
        }

        if (isAdd) {
            this.availableMargin += amount;
            this.capitalNet += amount;
            this.showMessage(`Capital agregado: +${amount.toFixed(2)} USDT`, 'success');
        } else {
            if (amount > this.availableMargin) {
                this.showMessage('Margen disponible insuficiente para retirar', 'error');
                return;
            }
            this.availableMargin -= amount;
            this.capitalNet = Math.max(0, this.capitalNet - amount);
            this.showMessage(`Capital retirado: -${amount.toFixed(2)} USDT`, 'warning');
        }

        capitalInput.value = '';
        this.updateDisplay();
        this.saveData();
    }

    loadData() {
        const savedData = DataManager.loadData('manualFuturesData');
        if (savedData) {
            this.availableMargin = typeof savedData.availableMargin === 'number' ? savedData.availableMargin : 0;
            this.usedMargin = typeof savedData.usedMargin === 'number' ? savedData.usedMargin : 0;
            this.unrealizedPnl = typeof savedData.unrealizedPnl === 'number' ? savedData.unrealizedPnl : 0;
            this.realizedPnl = typeof savedData.realizedPnl === 'number' ? savedData.realizedPnl : 0;
            this.fundingFees = typeof savedData.fundingFees === 'number' ? savedData.fundingFees : 0;
            this.totalTrades = typeof savedData.totalTrades === 'number' ? savedData.totalTrades : 0;
            this.capitalNet = typeof savedData.capitalNet === 'number' ? savedData.capitalNet : this.availableMargin + this.usedMargin;
            this.activePositions = savedData.activePositions || [];
            this.tradeHistory = savedData.tradeHistory || [];
            this.leverage = savedData.leverage || 10;
            this.symbol = savedData.symbol || 'BTCUSDT';
            
            // Restore form values if saved
            if (savedData.formData) {
                setTimeout(() => {
                    const symbolSelect = document.getElementById('symbol-manual-futures');
                    if (symbolSelect) symbolSelect.value = this.symbol;
                    
                    // Restore leverage selection
                    document.querySelectorAll('#manual-futures .leverage-btn').forEach(btn => {
                        btn.classList.remove('active');
                        if (parseInt(btn.dataset.leverage) === this.leverage) {
                            btn.classList.add('active');
                        }
                    });
                }, 100);
            }
        }
    }

    saveData() {
        const dataToSave = {
            availableMargin: this.availableMargin,
            usedMargin: this.usedMargin,
            unrealizedPnl: this.unrealizedPnl,
            realizedPnl: this.realizedPnl,
            fundingFees: this.fundingFees,
            totalTrades: this.totalTrades,
            capitalNet: this.capitalNet,
            activePositions: this.activePositions,
            tradeHistory: this.tradeHistory,
            leverage: this.leverage,
            symbol: this.symbol,
            formData: {
                orderType: this.orderType,
                orderMode: this.orderMode
            },
            lastSaved: new Date().toISOString()
        };
        
        DataManager.saveData('manualFuturesData', dataToSave);
    }

    setupAutoSave() {
        // Save data every 10 seconds
        setInterval(() => {
            this.saveData();
        }, 10000);
        
        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.saveData();
        });
    }

    showMessage(message, type) {
        const messageArea = document.getElementById('messageArea-manual-futures');
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
