/**
 * Trading manual Spot (simulado).
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class ManualSpotTrader {
    constructor() {
        this.currentPrice = 0;
        this.usdtBalance = 0;
        this.cryptoBalance = 0;
        this.totalValue = 0;
        this.totalPnl = 0;
        this.totalTrades = 0;
        this.capitalNet = 0;
        this.activePositions = [];
        this.tradeHistory = [];
        this.chart = null;
        this.priceHistory = [];
        this.orderType = 'buy';
        this.orderMode = 'limit';
        this.symbol = 'BTCUSDT';
        
        this.init();
    }

    init() {
        this.loadData(); // Load saved data first
        this.setupEventListeners();
        this.initializeChart();
        this.getCurrentPrice();
        this.updateDisplay();
        this.startPriceUpdates();
        this.setupAutoSave(); // Setup auto-save
    }

    startPriceUpdates() {
        // Update price every 3 seconds
        setInterval(() => {
            this.getCurrentPrice();
            this.checkStopLossTakeProfit();
        }, 3000);
    }

    setupEventListeners() {
        // Order type selector (Buy/Sell)
        document.querySelectorAll('#manual-spot .order-type-btn[data-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#manual-spot .order-type-btn[data-type]').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                this.orderType = btn.dataset.type;
                this.updateOrderButtons();
            });
        });

        // Order mode selector (Market/Limit)
        document.querySelectorAll('#manual-spot .order-type-btn[data-order]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#manual-spot .order-type-btn[data-order]').forEach(b => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                this.orderMode = btn.dataset.order;
                this.updateOrderForm();
            });
        });

        // Symbol change
        document.getElementById('symbol-manual-spot').addEventListener('change', () => {
            this.symbol = document.getElementById('symbol-manual-spot').value;
            this.getCurrentPrice();
            this.updateSymbolDisplay();
        });

        // Price/Quantity changes
        document.getElementById('orderPrice-manual-spot').addEventListener('input', () => {
            this.calculateTotal();
        });
        
        document.getElementById('orderQuantity-manual-spot').addEventListener('input', () => {
            this.calculateTotal();
        });

        // Execute buttons
        document.getElementById('executeBuy-manual-spot').addEventListener('click', () => {
            this.executeTrade('buy');
        });
        
        document.getElementById('executeSell-manual-spot').addEventListener('click', () => {
            this.executeTrade('sell');
        });

        // Balance editor button
        document.getElementById('editBalanceSpot').addEventListener('click', () => {
            this.editBalance();
        });

        const addCapitalBtn = document.getElementById('addCapitalSpot');
        if (addCapitalBtn) {
            addCapitalBtn.addEventListener('click', () => {
                this.updateCapital(true);
            });
        }

        const removeCapitalBtn = document.getElementById('removeCapitalSpot');
        if (removeCapitalBtn) {
            removeCapitalBtn.addEventListener('click', () => {
                this.updateCapital(false);
            });
        }

        // Advanced order buttons
        document.querySelectorAll('#manual-spot .advanced-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all buttons
                document.querySelectorAll('#manual-spot .advanced-order-btn').forEach(b => b.classList.remove('active'));
                
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Show form for selected order type
                const orderType = e.target.dataset.type;
                this.showAdvancedOrderForm(orderType);
            });
        });
    }

    async getCurrentPrice() {
        try {
            const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${this.symbol}`);
            const data = await response.json();
            this.currentPrice = parseFloat(data.price);
            
            // Update connection status
            this.updateConnectionStatus(true);
            
            // Update current price display
            const priceDisplay = document.getElementById('currentPriceDisplay-manual-spot');
            if (priceDisplay) {
                priceDisplay.textContent = this.currentPrice.toLocaleString();
            }
            
            // Update price in form
            if (this.orderMode === 'market') {
                document.getElementById('orderPrice-manual-spot').value = this.currentPrice;
            }
            
            this.calculateTotal();
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

    calculateTotal() {
        const price = parseFloat(document.getElementById('orderPrice-manual-spot').value) || 0;
        const quantity = parseFloat(document.getElementById('orderQuantity-manual-spot').value) || 0;
        const total = price * quantity;
        
        document.getElementById('orderTotal-manual-spot').value = total.toFixed(2);
    }

    updateSymbolDisplay() {
        const cryptoSymbol = this.symbol.replace('USDT', '');
        document.getElementById('buySymbol-manual-spot').textContent = cryptoSymbol;
        document.getElementById('sellSymbol-manual-spot').textContent = cryptoSymbol;
        this.updateDisplay();
    }

    updateOrderButtons() {
        const buyBtn = document.getElementById('executeBuy-manual-spot');
        const sellBtn = document.getElementById('executeSell-manual-spot');
        
        if (this.orderType === 'buy') {
            buyBtn.disabled = false;
            sellBtn.disabled = true;
        } else {
            buyBtn.disabled = true;
            sellBtn.disabled = false;
        }
    }

    updateOrderForm() {
        const priceInput = document.getElementById('orderPrice-manual-spot');
        if (this.orderMode === 'market') {
            priceInput.value = this.currentPrice;
            priceInput.disabled = true;
        } else {
            priceInput.disabled = false;
        }
    }

    executeTrade(type) {
        const price = parseFloat(document.getElementById('orderPrice-manual-spot').value) || 0;
        const quantity = parseFloat(document.getElementById('orderQuantity-manual-spot').value) || 0;
        const total = price * quantity;
        const fee = total * 0.001; // 0.1% fee
        const stopLoss = parseFloat(document.getElementById('stopLoss-manual-spot').value) || 0;
        const takeProfit = parseFloat(document.getElementById('takeProfit-manual-spot').value) || 0;

        if (price <= 0 || quantity <= 0) {
            this.showMessage('Precio y cantidad deben ser mayores a 0', 'error');
            return;
        }

        if (type === 'buy') {
            if (this.usdtBalance < total + fee) {
                this.showMessage('Balance insuficiente para la compra', 'error');
                return;
            }
            
            // Execute buy order
            this.usdtBalance -= (total + fee);
            this.cryptoBalance += quantity;
            
            // Create position with stop loss and take profit
            const position = {
                id: Date.now(),
                type: 'long',
                symbol: this.symbol,
                entryPrice: price,
                quantity: quantity,
                value: total,
                fee: fee,
                stopLoss: stopLoss > 0 ? price * (1 - stopLoss / 100) : null,
                takeProfit: takeProfit > 0 ? price * (1 + takeProfit / 100) : null,
                timestamp: new Date()
            };
            
            this.activePositions.push(position);
            this.showMessage(`Compra ejecutada: ${quantity} ${this.symbol.replace('USDT', '')} a $${price}`, 'success');
            
        } else if (type === 'sell') {
            if (this.cryptoBalance < quantity) {
                this.showMessage('Balance insuficiente para la venta', 'error');
                return;
            }
            
            // Execute sell order
            this.cryptoBalance -= quantity;
            this.usdtBalance += (total - fee);
            
            // Remove from positions or reduce quantity
            this.closePosition(quantity, price);
            this.showMessage(`Venta ejecutada: ${quantity} ${this.symbol.replace('USDT', '')} a $${price}`, 'success');
        }

        this.totalTrades++;
        this.updateDisplay();
        this.checkStopLossTakeProfit();
        this.saveData(); // Save after trade execution
    }

    closePosition(quantity, price) {
        // Find and close positions
        let remainingQuantity = quantity;
        const cryptoSymbol = this.symbol.replace('USDT', '');
        
        for (let i = this.activePositions.length - 1; i >= 0 && remainingQuantity > 0; i--) {
            const position = this.activePositions[i];
            if (position.symbol === this.symbol) {
                const closeQuantity = Math.min(remainingQuantity, position.quantity);
                const pnl = (price - position.entryPrice) * closeQuantity - position.fee * (closeQuantity / position.quantity);
                
                this.totalPnl += pnl;
                position.quantity -= closeQuantity;
                remainingQuantity -= closeQuantity;
                
                if (position.quantity <= 0) {
                    this.activePositions.splice(i, 1);
                }
                
                this.tradeHistory.push({
                    type: 'close',
                    symbol: cryptoSymbol,
                    quantity: closeQuantity,
                    entryPrice: position.entryPrice,
                    exitPrice: price,
                    pnl: pnl,
                    timestamp: new Date()
                });
            }
        }
    }

    checkStopLossTakeProfit() {
        // Check if any positions hit stop loss or take profit
        // Use a copy of the array to avoid issues with concurrent modification
        const positionsToCheck = [...this.activePositions];
        
        positionsToCheck.forEach((position, index) => {
            if (position.stopLoss && this.currentPrice <= position.stopLoss) {
                // Execute stop loss
                this.closePositionById(position.id, 'stop-loss');
            }
            
            if (position.takeProfit && this.currentPrice >= position.takeProfit) {
                // Execute take profit
                this.closePositionById(position.id, 'take-profit');
            }
        });

        // Check advanced orders
        this.checkAdvancedOrders();
    }

    checkAdvancedOrders() {
        if (!this.advancedOrders) return;

        this.advancedOrders.forEach(order => {
            if (order.status !== 'active') return;

            switch (order.type) {
                case 'trailing-stop':
                    this.processTrailingStop(order);
                    break;
                case 'oco':
                    this.processOCOOrder(order);
                    break;
                case 'scale-in':
                    this.processScaleInOrder(order);
                    break;
                case 'scale-out':
                    this.processScaleOutOrder(order);
                    break;
            }
        });

        // Remove completed orders
        this.advancedOrders = this.advancedOrders.filter(order => order.status === 'active');
    }

    processTrailingStop(order) {
        // Update highest price and adjust stop
        if (this.currentPrice > order.highestPrice) {
            order.highestPrice = this.currentPrice;
            order.currentStopPrice = this.currentPrice * (1 - order.distance / 100);
        }
        
        // Check if stop triggered
        if (this.currentPrice <= order.currentStopPrice) {
            // Execute the trailing stop
            if (order.amount <= this.cryptoBalance) {
                // Simulate sell execution
                this.cryptoBalance -= order.amount;
                this.usdtBalance += order.amount * this.currentPrice;
                
                this.tradeHistory.push({
                    symbol: this.symbol,
                    type: 'sell',
                    amount: order.amount,
                    price: this.currentPrice,
                    pnl: order.amount * (this.currentPrice - order.triggerPrice),
                    timestamp: new Date().toISOString(),
                    reason: 'trailing-stop'
                });

                order.status = 'executed';
                this.showMessage(`🎯 Trailing Stop ejecutado: ${order.amount.toFixed(6)} ${this.symbol.replace('USDT', '')} a $${this.currentPrice.toLocaleString()}`, 'info');
                this.updateDisplay();
                this.saveData();
            }
        }
    }

    processOCOOrder(order) {
        // Check take profit
        if (this.currentPrice >= order.takeProfitPrice) {
            if (order.amount <= this.cryptoBalance) {
                this.cryptoBalance -= order.amount;
                this.usdtBalance += order.amount * order.takeProfitPrice;
                
                this.tradeHistory.push({
                    symbol: this.symbol,
                    type: 'sell',
                    amount: order.amount,
                    price: order.takeProfitPrice,
                    pnl: order.amount * (order.takeProfitPrice - order.entryPrice),
                    timestamp: new Date().toISOString(),
                    reason: 'oco-take-profit'
                });

                order.status = 'executed-tp';
                this.showMessage(`⚖️ OCO Take Profit ejecutado a $${order.takeProfitPrice.toLocaleString()}`, 'success');
                this.updateDisplay();
                this.saveData();
            }
        }
        // Check stop loss
        else if (this.currentPrice <= order.stopLossPrice) {
            if (order.amount <= this.cryptoBalance) {
                this.cryptoBalance -= order.amount;
                this.usdtBalance += order.amount * order.stopLossPrice;
                
                this.tradeHistory.push({
                    symbol: this.symbol,
                    type: 'sell',
                    amount: order.amount,
                    price: order.stopLossPrice,
                    pnl: order.amount * (order.stopLossPrice - order.entryPrice),
                    timestamp: new Date().toISOString(),
                    reason: 'oco-stop-loss'
                });

                order.status = 'executed-sl';
                this.showMessage(`⚖️ OCO Stop Loss ejecutado a $${order.stopLossPrice.toLocaleString()}`, 'error');
                this.updateDisplay();
                this.saveData();
            }
        }
    }

    processScaleInOrder(order) {
        const amountPerLevel = order.totalAmount / order.levels;
        
        for (let i = order.executedLevels; i < order.levels; i++) {
            const targetPrice = order.basePrice * Math.pow(1 - order.reduction / 100, i);
            
            if (this.currentPrice <= targetPrice && amountPerLevel <= this.usdtBalance) {
                // Execute this level
                const cryptoAmount = amountPerLevel / this.currentPrice;
                this.cryptoBalance += cryptoAmount;
                this.usdtBalance -= amountPerLevel;
                
                this.tradeHistory.push({
                    symbol: this.symbol,
                    type: 'buy',
                    amount: cryptoAmount,
                    price: this.currentPrice,
                    pnl: 0,
                    timestamp: new Date().toISOString(),
                    reason: `scale-in-level-${i + 1}`
                });

                order.executedLevels++;
                this.showMessage(`📈 Scale In Nivel ${i + 1} ejecutado: $${amountPerLevel.toFixed(2)} a $${this.currentPrice.toLocaleString()}`, 'success');
                this.updateDisplay();
                this.saveData();
                
                // Check if all levels executed
                if (order.executedLevels >= order.levels) {
                    order.status = 'completed';
                    this.showMessage(`📈 Scale In completado: Todos los ${order.levels} niveles ejecutados`, 'success');
                }
                break; // Only execute one level per price check
            }
        }
    }

    processScaleOutOrder(order) {
        const amountPerLevel = order.totalAmount / order.levels;
        
        for (let i = order.executedLevels; i < order.levels; i++) {
            const targetPrice = order.basePrice * Math.pow(1 + order.increment / 100, i);
            
            if (this.currentPrice >= targetPrice && amountPerLevel <= this.cryptoBalance) {
                // Execute this level
                this.cryptoBalance -= amountPerLevel;
                this.usdtBalance += amountPerLevel * this.currentPrice;
                
                this.tradeHistory.push({
                    symbol: this.symbol,
                    type: 'sell',
                    amount: amountPerLevel,
                    price: this.currentPrice,
                    pnl: amountPerLevel * (this.currentPrice - order.basePrice),
                    timestamp: new Date().toISOString(),
                    reason: `scale-out-level-${i + 1}`
                });

                order.executedLevels++;
                this.showMessage(`📉 Scale Out Nivel ${i + 1} ejecutado: ${amountPerLevel.toFixed(6)} ${this.symbol.replace('USDT', '')} a $${this.currentPrice.toLocaleString()}`, 'success');
                this.updateDisplay();
                this.saveData();
                
                // Check if all levels executed amag
                if (order.executedLevels >= order.levels) {
                    order.status = 'completed';
                    this.showMessage(`📉 Scale Out completado: Todos los ${order.levels} niveles ejecutados`, 'success');
                }
                break; // Only execute one level per price check
            }
        }
    }

    updatePositionValues() {
        this.activePositions.forEach(position => {
            position.currentValue = position.quantity * this.currentPrice;
            position.unrealizedPnl = (this.currentPrice - position.entryPrice) * position.quantity - position.fee;
        });
    }

    updateDisplay() {
        // Update balances
        document.getElementById('spotBalance').textContent = `${this.usdtBalance.toFixed(2)} USDT`;
        document.getElementById('usdtBalance-manual-spot').textContent = `${this.usdtBalance.toFixed(2)} USDT`;

        const capitalNetElement = document.getElementById('spotCapitalNet');
        if (capitalNetElement) {
            capitalNetElement.textContent = `Capital neto: ${this.capitalNet.toFixed(2)} USDT`;
        }
        
        const cryptoSymbol = this.symbol.replace('USDT', '');
        document.getElementById('cryptoBalance-manual-spot').textContent = `${this.cryptoBalance.toFixed(6)} ${cryptoSymbol}`;
        
        // Calculate total value
        this.totalValue = this.usdtBalance + (this.cryptoBalance * this.currentPrice);
        document.getElementById('totalValue-manual-spot').textContent = `${this.totalValue.toFixed(2)} USDT`;
        
        // Calculate total PnL vs net capital
        const totalPnlValue = this.totalValue - this.capitalNet;
        const totalPnlPercent = this.capitalNet > 0 ? (totalPnlValue / this.capitalNet) * 100 : 0;
        document.getElementById('totalPnl-manual-spot').textContent = 
            `${totalPnlValue >= 0 ? '+' : ''}${totalPnlValue.toFixed(2)} USDT (${totalPnlPercent >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%)`;
        
        document.getElementById('totalTrades-manual-spot').textContent = this.totalTrades;
        
        // Update active positions display
        this.updateActivePositions();
    }

    updateActivePositions() {
        const container = document.getElementById('activePositions-manual-spot');
        
        if (this.activePositions.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #bdc3c7; padding: 20px;">No hay posiciones activas</div>';
            return;
        }
        
        container.innerHTML = this.activePositions.map(position => {
            const pnl = (this.currentPrice - position.entryPrice) * position.quantity - position.fee;
            const pnlPercent = (pnl / position.value) * 100;
            const pnlClass = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            
            return `
                <div class="position-item">
                    <div>
                        <strong>${position.symbol.replace('USDT', '')}</strong><br>
                        ${position.quantity.toFixed(6)} @ $${position.entryPrice.toFixed(2)}
                    </div>
                    <div class="${pnlClass}">
                        ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}<br>
                        (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)
                        <br><button onclick="window.manualSpotTrader.closeIndividualPosition(${position.id})" 
                                  style="font-size: 10px; padding: 2px 6px; margin-top: 4px; background: #e74c3c; border: none; border-radius: 3px; color: white; cursor: pointer;">
                            Cerrar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    initializeChart() {
        const ctx = document.getElementById('spotChart-manual');
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
                    }
                }
            }
        });

        // Update chart periodically
        setInterval(() => {
            this.updateChart();
            this.updateTechnicalIndicators();
        }, 5000);
    }

    updateTechnicalIndicators() {
        if (this.priceHistory.length > 0) {
            TechnicalIndicators.updateIndicators('spot', this.currentPrice, this.priceHistory);
        }
    }

    updateChart() {
        if (!this.chart) return;

        this.priceHistory.push({
            time: new Date(),
            price: this.currentPrice
        });

        // Keep only last 20 points
        if (this.priceHistory.length > 20) {
            this.priceHistory.shift();
        }

        const labels = this.priceHistory.map(item => 
            item.time.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        );
        
        const data = this.priceHistory.map(item => item.price);

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update('none');
    }

    editBalance() {
        const currentBalance = this.usdtBalance + (this.cryptoBalance * this.currentPrice);
        const newBalance = prompt(`Ingresa el nuevo balance total (USDT):\n\nBalance actual: ${currentBalance.toFixed(2)} USDT`, currentBalance.toFixed(2));
        
        if (newBalance !== null && !isNaN(newBalance) && parseFloat(newBalance) >= 0) {
            const balanceValue = parseFloat(newBalance);
            
            // Reset balances
            const cryptoValue = this.cryptoBalance * this.currentPrice;
            if (balanceValue < cryptoValue && this.currentPrice > 0) {
                this.cryptoBalance = balanceValue / this.currentPrice;
                this.usdtBalance = 0;
            } else {
                this.usdtBalance = balanceValue - cryptoValue;
            }
            
            this.capitalNet = balanceValue;
            
            this.totalValue = balanceValue;
            this.updateDisplay();
            this.saveData(); // Save after balance edit
            this.showMessage(`Balance actualizado a ${balanceValue.toFixed(2)} USDT`, 'success');
        } else if (newBalance !== null) {
            this.showMessage('Por favor ingresa un valor válido', 'error');
        }
    }

    updateCapital(isAdd) {
        const capitalInput = document.getElementById('spotCapitalAmount');
        if (!capitalInput) return;

        const amount = parseFloat(capitalInput.value);
        if (!amount || amount <= 0) {
            this.showMessage('Ingresa un monto válido', 'error');
            return;
        }

        if (isAdd) {
            this.usdtBalance += amount;
            this.capitalNet += amount;
            this.showMessage(`Capital agregado: +${amount.toFixed(2)} USDT`, 'success');
        } else {
            if (amount > this.usdtBalance) {
                this.showMessage('Fondos insuficientes para retirar', 'error');
                return;
            }
            this.usdtBalance -= amount;
            this.capitalNet = Math.max(0, this.capitalNet - amount);
            this.showMessage(`Capital retirado: -${amount.toFixed(2)} USDT`, 'warning');
        }

        capitalInput.value = '';
        this.updateDisplay();
        this.saveData();
    }

    // ===== ADVANCED ORDERS FUNCTIONALITY =====
    showAdvancedOrderForm(orderType) {
        const formContainer = document.getElementById('advancedOrderForm-spot');
        if (!formContainer) return;

        formContainer.style.display = 'block';
        
        let formHTML = '';
        switch (orderType) {
            case 'trailing-stop':
                formHTML = this.createTrailingStopForm();
                break;
            case 'oco':
                formHTML = this.createOCOForm();
                break;
            case 'scale-in':
                formHTML = this.createScaleInForm();
                break;
            case 'scale-out':
                formHTML = this.createScaleOutForm();
                break;
            default:
                formContainer.style.display = 'none';
                return;
        }
        
        formContainer.innerHTML = formHTML;
        this.setupAdvancedOrderListeners(orderType);
    }

    createTrailingStopForm() {
        return `
            <div class="advanced-form">
                <h5>🎯 Trailing Stop Configuration</h5>
                <div class="form-group">
                    <label>Cantidad (${this.symbol.replace('USDT', '')})</label>
                    <input type="number" id="trailing-amount" step="0.001" placeholder="0.001" max="${this.cryptoBalance}">
                    <small>Disponible: ${this.cryptoBalance.toFixed(6)} ${this.symbol.replace('USDT', '')}</small>
                </div>
                <div class="form-group">
                    <label>Trail Distance (%)</label>
                    <input type="number" id="trailing-distance" value="2" step="0.1" min="0.1" max="10">
                    <small>Distancia en % que seguirá el precio</small>
                </div>
                <button class="execute-btn" id="createTrailingStop">🎯 Crear Trailing Stop</button>
                <button class="cancel-btn" onclick="document.getElementById('advancedOrderForm-spot').style.display='none'">❌ Cancelar</button>
            </div>
        `;
    }

    createOCOForm() {
        const profitPrice = (this.currentPrice * 1.05).toFixed(2);
        const lossPrice = (this.currentPrice * 0.95).toFixed(2);
        return `
            <div class="advanced-form">
                <h5>⚖️ OCO Order Configuration</h5>
                <div class="form-group">
                    <label>Cantidad (${this.symbol.replace('USDT', '')})</label>
                    <input type="number" id="oco-amount" step="0.001" placeholder="0.001" max="${this.cryptoBalance}">
                    <small>Disponible: ${this.cryptoBalance.toFixed(6)} ${this.symbol.replace('USDT', '')}</small>
                </div>
                <div class="form-group">
                    <label>🟢 Take Profit Price ($)</label>
                    <input type="number" id="oco-take-profit" step="0.01" value="${profitPrice}">
                    <small>Precio de ganancia objetivo (+5%)</small>
                </div>
                <div class="form-group">
                    <label>🔴 Stop Loss Price ($)</label>
                    <input type="number" id="oco-stop-loss" step="0.01" value="${lossPrice}">
                    <small>Precio de pérdida máxima (-5%)</small>
                </div>
                <button class="execute-btn" id="createOCO">⚖️ Crear OCO Order</button>
                <button class="cancel-btn" onclick="document.getElementById('advancedOrderForm-spot').style.display='none'">❌ Cancelar</button>
            </div>
        `;
    }

    createScaleInForm() {
        return `
            <div class="advanced-form">
                <h5>📈 Scale In Configuration</h5>
                <div class="form-group">
                    <label>Inversión Total (USDT)</label>
                    <input type="number" id="scalein-total" step="1" value="500" max="${this.usdtBalance}">
                    <small>Disponible: ${this.usdtBalance.toFixed(2)} USDT</small>
                </div>
                <div class="form-group">
                    <label>Número de Entradas</label>
                    <select id="scalein-levels">
                        <option value="3">3 niveles</option>
                        <option value="4" selected>4 niveles</option>
                        <option value="5">5 niveles</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Reducción por Nivel (%)</label>
                    <input type="number" id="scalein-reduction" value="3" step="0.5" min="1" max="10">
                    <small>% de reducción en precio entre niveles</small>
                </div>
                <div id="scalein-preview" class="info-box"></div>
                <button class="execute-btn" id="createScaleIn">📈 Crear Scale In</button>
                <button class="preview-btn" id="previewScaleIn" style="background: #3498db;">👁️ Vista Previa</button>
                <button class="cancel-btn" onclick="document.getElementById('advancedOrderForm-spot').style.display='none'">❌ Cancelar</button>
            </div>
        `;
    }

    createScaleOutForm() {
        if (this.cryptoBalance === 0) {
            return `
                <div class="advanced-form">
                    <h5>📉 Scale Out Configuration</h5>
                    <div class="info-box">
                        <strong>⚠️ No tienes ${this.symbol.replace('USDT', '')} para vender</strong><br>
                        Necesitas tener crypto antes de crear una orden Scale Out.
                    </div>
                    <button class="cancel-btn" onclick="document.getElementById('advancedOrderForm-spot').style.display='none'">❌ Cerrar</button>
                </div>
            `;
        }

        return `
            <div class="advanced-form">
                <h5>📉 Scale Out Configuration</h5>
                <div class="form-group">
                    <label>Cantidad Total a Vender</label>
                    <input type="number" id="scaleout-amount" step="0.001" value="${this.cryptoBalance}" max="${this.cryptoBalance}">
                    <small>Disponible: ${this.cryptoBalance.toFixed(6)} ${this.symbol.replace('USDT', '')}</small>
                </div>
                <div class="form-group">
                    <label>Número de Salidas</label>
                    <select id="scaleout-levels">
                        <option value="3">3 niveles</option>
                        <option value="4" selected>4 niveles</option>
                        <option value="5">5 niveles</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Incremento por Nivel (%)</label>
                    <input type="number" id="scaleout-increment" value="5" step="0.5" min="1" max="15">
                    <small>% de incremento en precio entre niveles</small>
                </div>
                <div id="scaleout-preview" class="info-box"></div>
                <button class="execute-btn" id="createScaleOut">📉 Crear Scale Out</button>
                <button class="preview-btn" id="previewScaleOut" style="background: #3498db;">👁️ Vista Previa</button>
                <button class="cancel-btn" onclick="document.getElementById('advancedOrderForm-spot').style.display='none'">❌ Cancelar</button>
            </div>
        `;
    }

    setupAdvancedOrderListeners(orderType) {
        switch (orderType) {
            case 'trailing-stop':
                const createTrailingBtn = document.getElementById('createTrailingStop');
                if (createTrailingBtn) {
                    createTrailingBtn.addEventListener('click', () => this.createTrailingStopOrder());
                }
                break;
            case 'oco':
                const createOCOBtn = document.getElementById('createOCO');
                if (createOCOBtn) {
                    createOCOBtn.addEventListener('click', () => this.createOCOOrder());
                }
                break;
            case 'scale-in':
                const createScaleInBtn = document.getElementById('createScaleIn');
                const previewScaleInBtn = document.getElementById('previewScaleIn');
                if (createScaleInBtn) {
                    createScaleInBtn.addEventListener('click', () => this.createScaleInOrder());
                }
                if (previewScaleInBtn) {
                    previewScaleInBtn.addEventListener('click', () => this.previewScaleIn());
                }
                break;
            case 'scale-out':
                const createScaleOutBtn = document.getElementById('createScaleOut');
                const previewScaleOutBtn = document.getElementById('previewScaleOut');
                if (createScaleOutBtn) {
                    createScaleOutBtn.addEventListener('click', () => this.createScaleOutOrder());
                }
                if (previewScaleOutBtn) {
                    previewScaleOutBtn.addEventListener('click', () => this.previewScaleOut());
                }
                break;
        }
    }

    createTrailingStopOrder() {
        const amount = parseFloat(document.getElementById('trailing-amount').value);
        const distance = parseFloat(document.getElementById('trailing-distance').value);

        if (!amount || amount <= 0) {
            this.showMessage('Ingresa una cantidad válida', 'error');
            return;
        }

        if (amount > this.cryptoBalance) {
            this.showMessage('Cantidad insuficiente de crypto', 'error');
            return;
        }

        const order = {
            id: Date.now(),
            type: 'trailing-stop',
            amount: amount,
            distance: distance,
            triggerPrice: this.currentPrice,
            currentStopPrice: this.currentPrice * (1 - distance / 100),
            highestPrice: this.currentPrice,
            status: 'active',
            timestamp: new Date().toISOString()
        };

        if (!this.advancedOrders) this.advancedOrders = [];
        this.advancedOrders.push(order);

        this.showMessage(`🎯 Trailing Stop creado: ${amount} ${this.symbol.replace('USDT', '')} con trail de ${distance}%`, 'success');
        this.saveData();
        
        document.getElementById('advancedOrderForm-spot').style.display = 'none';
        document.querySelectorAll('#manual-spot .advanced-order-btn').forEach(btn => btn.classList.remove('active'));
    }

    createOCOOrder() {
        const amount = parseFloat(document.getElementById('oco-amount').value);
        const takeProfitPrice = parseFloat(document.getElementById('oco-take-profit').value);
        const stopLossPrice = parseFloat(document.getElementById('oco-stop-loss').value);

        if (!amount || amount <= 0) {
            this.showMessage('Ingresa una cantidad válida', 'error');
            return;
        }

        if (amount > this.cryptoBalance) {
            this.showMessage('Cantidad insuficiente de crypto', 'error');
            return;
        }

        if (!takeProfitPrice || !stopLossPrice) {
            this.showMessage('Ingresa precios válidos para Take Profit y Stop Loss', 'error');
            return;
        }

        if (takeProfitPrice <= this.currentPrice || stopLossPrice >= this.currentPrice) {
            this.showMessage('Take Profit debe ser mayor al precio actual y Stop Loss menor', 'error');
            return;
        }

        const order = {
            id: Date.now(),
            type: 'oco',
            amount: amount,
            entryPrice: this.currentPrice,
            takeProfitPrice: takeProfitPrice,
            stopLossPrice: stopLossPrice,
            status: 'active',
            timestamp: new Date().toISOString()
        };

        if (!this.advancedOrders) this.advancedOrders = [];
        this.advancedOrders.push(order);

        this.showMessage(`⚖️ OCO Order creada: TP $${takeProfitPrice.toLocaleString()} / SL $${stopLossPrice.toLocaleString()}`, 'success');
        this.saveData();
        
        document.getElementById('advancedOrderForm-spot').style.display = 'none';
        document.querySelectorAll('#manual-spot .advanced-order-btn').forEach(btn => btn.classList.remove('active'));
    }

    previewScaleIn() {
        const total = parseFloat(document.getElementById('scalein-total').value);
        const levels = parseInt(document.getElementById('scalein-levels').value);
        const reduction = parseFloat(document.getElementById('scalein-reduction').value);

        if (!total || !levels || !reduction) {
            document.getElementById('scalein-preview').innerHTML = '<small>Complete los campos para ver vista previa</small>';
            return;
        }

        const basePrice = this.currentPrice;
        const amountPerLevel = total / levels;
        let preview = '<strong>📊 Vista Previa Scale In:</strong><br><br>';

        for (let i = 0; i < levels; i++) {
            const price = basePrice * Math.pow(1 - reduction / 100, i);
            const crypto = amountPerLevel / price;
            const status = price <= this.currentPrice ? '✅' : '⏳';
            preview += `${status} Nivel ${i + 1}: $${amountPerLevel.toFixed(0)} a $${price.toLocaleString()} = ${crypto.toFixed(6)} ${this.symbol.replace('USDT', '')}<br>`;
        }

        document.getElementById('scalein-preview').innerHTML = preview;
    }

    createScaleInOrder() {
        const total = parseFloat(document.getElementById('scalein-total').value);
        const levels = parseInt(document.getElementById('scalein-levels').value);
        const reduction = parseFloat(document.getElementById('scalein-reduction').value);

        if (!total || !levels || !reduction) {
            this.showMessage('Completa todos los campos', 'error');
            return;
        }

        if (total > this.usdtBalance) {
            this.showMessage('Fondos insuficientes', 'error');
            return;
        }

        const basePrice = this.currentPrice;
        const order = {
            id: Date.now(),
            type: 'scale-in',
            totalAmount: total,
            levels: levels,
            reduction: reduction,
            basePrice: basePrice,
            executedLevels: 0,
            status: 'active',
            timestamp: new Date().toISOString()
        };

        if (!this.advancedOrders) this.advancedOrders = [];
        this.advancedOrders.push(order);

        this.showMessage(`📈 Scale In creado: ${levels} niveles por $${total.toLocaleString()} total`, 'success');
        this.saveData();
        
        document.getElementById('advancedOrderForm-spot').style.display = 'none';
        document.querySelectorAll('#manual-spot .advanced-order-btn').forEach(btn => btn.classList.remove('active'));
    }

    previewScaleOut() {
        const amount = parseFloat(document.getElementById('scaleout-amount').value);
        const levels = parseInt(document.getElementById('scaleout-levels').value);
        const increment = parseFloat(document.getElementById('scaleout-increment').value);

        if (!amount || !levels || !increment) {
            document.getElementById('scaleout-preview').innerHTML = '<small>Complete los campos para ver vista previa</small>';
            return;
        }

        const basePrice = this.currentPrice;
        const amountPerLevel = amount / levels;
        let preview = '<strong>📊 Vista Previa Scale Out:</strong><br><br>';

        for (let i = 0; i < levels; i++) {
            const price = basePrice * Math.pow(1 + increment / 100, i);
            const value = amountPerLevel * price;
            const status = price <= this.currentPrice ? '✅' : '⏳';
            preview += `${status} Nivel ${i + 1}: ${amountPerLevel.toFixed(6)} ${this.symbol.replace('USDT', '')} a $${price.toLocaleString()} = $${value.toFixed(2)}<br>`;
        }

        document.getElementById('scaleout-preview').innerHTML = preview;
    }

    createScaleOutOrder() {
        const amount = parseFloat(document.getElementById('scaleout-amount').value);
        const levels = parseInt(document.getElementById('scaleout-levels').value);
        const increment = parseFloat(document.getElementById('scaleout-increment').value);

        if (!amount || !levels || !increment) {
            this.showMessage('Completa todos los campos', 'error');
            return;
        }

        if (amount > this.cryptoBalance) {
            this.showMessage('Cantidad insuficiente de crypto', 'error');
            return;
        }

        const basePrice = this.currentPrice;
        const order = {
            id: Date.now(),
            type: 'scale-out',
            totalAmount: amount,
            levels: levels,
            increment: increment,
            basePrice: basePrice,
            executedLevels: 0,
            status: 'active',
            timestamp: new Date().toISOString()
        };

        if (!this.advancedOrders) this.advancedOrders = [];
        this.advancedOrders.push(order);

        this.showMessage(`📉 Scale Out creado: ${levels} niveles para ${amount.toFixed(6)} ${this.symbol.replace('USDT', '')}`, 'success');
        this.saveData();
        
        document.getElementById('advancedOrderForm-spot').style.display = 'none';
        document.querySelectorAll('#manual-spot .advanced-order-btn').forEach(btn => btn.classList.remove('active'));
    }

    closeIndividualPosition(positionId) {
        this.closePositionById(positionId, 'manual');
    }

    closePositionById(positionId, reason = 'manual') {
        const positionIndex = this.activePositions.findIndex(p => p.id === positionId);
        if (positionIndex === -1) {
            this.showMessage('Posición no encontrada', 'error');
            return;
        }

        const position = this.activePositions[positionIndex];
        const pnl = (this.currentPrice - position.entryPrice) * position.quantity - position.fee;

        // Return crypto to USDT at current market price
        this.cryptoBalance -= position.quantity;
        this.usdtBalance += (position.quantity * this.currentPrice);

        // Update total PnL
        this.totalPnl += pnl;

        // Remove position
        this.activePositions.splice(positionIndex, 1);

        // Record in history
        this.tradeHistory.push({
            type: 'close',
            symbol: position.symbol.replace('USDT', ''),
            quantity: position.quantity,
            entryPrice: position.entryPrice,
            exitPrice: this.currentPrice,
            pnl: pnl,
            reason: reason,
            timestamp: new Date()
        });

        this.updateDisplay();
        this.saveData();

        const cryptoSymbol = position.symbol.replace('USDT', '');
        const reasonText = reason === 'stop-loss' ? 'Stop Loss' : reason === 'take-profit' ? 'Take Profit' : 'cerrada';
        this.showMessage(
            `Posición ${cryptoSymbol} ${reasonText}: PnL ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`,
            pnl >= 0 ? 'success' : 'error'
        );
    }

    loadData() {
        const savedData = DataManager.loadData('manualSpotData');
        if (savedData) {
            this.usdtBalance = typeof savedData.usdtBalance === 'number' ? savedData.usdtBalance : 0;
            this.cryptoBalance = typeof savedData.cryptoBalance === 'number' ? savedData.cryptoBalance : 0;
            this.totalValue = typeof savedData.totalValue === 'number' ? savedData.totalValue : 0;
            this.totalPnl = typeof savedData.totalPnl === 'number' ? savedData.totalPnl : 0;
            this.totalTrades = typeof savedData.totalTrades === 'number' ? savedData.totalTrades : 0;
            this.capitalNet = typeof savedData.capitalNet === 'number' ? savedData.capitalNet : this.usdtBalance;
            this.activePositions = savedData.activePositions || [];
            this.tradeHistory = savedData.tradeHistory || [];
            this.symbol = savedData.symbol || 'BTCUSDT';
            
            // Restore form values if saved
            if (savedData.formData) {
                setTimeout(() => {
                    const symbolSelect = document.getElementById('symbol-manual-spot');
                    if (symbolSelect) symbolSelect.value = this.symbol;
                }, 100);
            }
        }
    }

    saveData() {
        const dataToSave = {
            usdtBalance: this.usdtBalance,
            cryptoBalance: this.cryptoBalance,
            totalValue: this.totalValue,
            totalPnl: this.totalPnl,
            totalTrades: this.totalTrades,
            capitalNet: this.capitalNet,
            activePositions: this.activePositions,
            tradeHistory: this.tradeHistory,
            symbol: this.symbol,
            formData: {
                orderType: this.orderType,
                orderMode: this.orderMode
            },
            lastSaved: new Date().toISOString()
        };
        
        DataManager.saveData('manualSpotData', dataToSave);
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
        const messageArea = document.getElementById('messageArea-manual-spot');
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
