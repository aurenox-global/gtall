/**
 * DCA Bot (simulado).
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class DCABot {
    constructor() {
        this.isRunning = false;
        this.symbol = 'BTCUSDT';
        this.amount = 50;
        this.frequency = 'daily';
        this.target = 1000;
        this.totalInvested = 0;
        this.totalQuantity = 0;
        this.averagePrice = 0;
        this.executions = [];
        this.nextExecution = null;
        this.currentPrice = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDates();
        this.loadData();
        this.getCurrentPrice();
        this.updateDisplay();
    }

    setDefaultDates() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const startDateElement = document.getElementById('dca-start-date');
        const endDateElement = document.getElementById('backtest-end');
        
        if (startDateElement) {
            startDateElement.value = tomorrow.toISOString().split('T')[0];
        }
        if (endDateElement) {
            endDateElement.value = today.toISOString().split('T')[0];
        }
    }

    setupEventListeners() {
        const startBtn = document.getElementById('startDCA');
        const stopBtn = document.getElementById('stopDCA');
        const symbolSelect = document.getElementById('dca-symbol');
        
        if (startBtn) startBtn.addEventListener('click', () => this.startDCA());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopDCA());
        if (symbolSelect) {
            symbolSelect.addEventListener('change', (e) => {
                this.symbol = e.target.value;
                this.getCurrentPrice();
            });
        }
    }

    async getCurrentPrice() {
        try {
            const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${this.symbol}`);
            const data = await response.json();
            this.currentPrice = parseFloat(data.price);
        } catch (error) {
            console.error('Error fetching price:', error);
        }
    }

    startDCA() {
        this.amount = parseFloat(document.getElementById('dca-amount').value);
        this.frequency = document.getElementById('dca-frequency').value;
        this.target = parseFloat(document.getElementById('dca-target').value);
        
        this.isRunning = true;
        this.scheduleNextExecution();
        this.updateDisplay();
        this.showMessage('DCA Bot iniciado correctamente', 'success');
    }

    stopDCA() {
        this.isRunning = false;
        if (this.dcaInterval) {
            clearInterval(this.dcaInterval);
        }
        this.updateDisplay();
        this.showMessage('DCA Bot detenido', 'error');
    }

    scheduleNextExecution() {
        // Intervalos cortos para demostración
        const frequencies = {
            'daily': 30 * 1000,    // 30 segundos para demo
            'weekly': 60 * 1000,   // 1 minuto para demo
            'monthly': 120 * 1000,  // 2 minutos para demo
            'custom': 15 * 1000    // 15 segundos para demo
        };

        const interval = frequencies[this.frequency] || frequencies['daily'];
        
        this.dcaInterval = setInterval(() => {
            if (this.totalInvested < this.target) {
                this.executeDCA();
            } else {
                this.stopDCA();
                this.showMessage('Meta DCA alcanzada!', 'success');
            }
        }, interval);

        this.nextExecution = new Date(Date.now() + interval);
    }

    async executeDCA() {
        await this.getCurrentPrice();
        
        const quantity = this.amount / this.currentPrice;
        this.totalInvested += this.amount;
        this.totalQuantity += quantity;
        this.averagePrice = this.totalInvested / this.totalQuantity;

        this.executions.push({
            date: new Date(),
            price: this.currentPrice,
            amount: this.amount,
            quantity: quantity
        });

        this.updateDisplay();
        this.saveData();
        this.showMessage(`DCA ejecutado: ${quantity.toFixed(6)} ${this.symbol.replace('USDT', '')} @ $${this.currentPrice}`, 'success');
    }

    updateDisplay() {
        // Safely update text content
        const elements = {
            'dca-status': this.isRunning ? 'Activo' : 'Inactivo',
            'dca-progress': `$${this.totalInvested} / $${this.target} (${((this.totalInvested/this.target)*100).toFixed(1)}%)`,
            'dca-next-execution': this.nextExecution ? this.nextExecution.toLocaleString() : '--',
            'dca-avg-price': this.averagePrice > 0 ? `$${this.averagePrice.toFixed(2)}` : '--',
            'dca-total-invested': `$${this.totalInvested.toFixed(2)}`,
            'dca-total-quantity': `${this.totalQuantity.toFixed(6)} ${this.symbol.replace('USDT', '')}`
        };

        Object.entries(elements).forEach(([id, text]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = text;
        });

        // Update button states
        const startBtn = document.getElementById('startDCA');
        const stopBtn = document.getElementById('stopDCA');
        
        if (startBtn && stopBtn) {
            startBtn.disabled = this.isRunning;
            stopBtn.disabled = !this.isRunning;
            
            const startIndicator = startBtn.querySelector('.status-indicator');
            const stopIndicator = stopBtn.querySelector('.status-indicator');
            
            if (startIndicator) {
                startIndicator.className = `status-indicator ${this.isRunning ? 'status-active' : 'status-inactive'}`;
            }
            if (stopIndicator) {
                stopIndicator.className = `status-indicator ${this.isRunning ? 'status-inactive' : 'status-inactive'}`;
            }
        }

        this.updateExecutionsList();
    }

    updateExecutionsList() {
        const container = document.getElementById('dca-executions');
        
        if (this.executions.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #bdc3c7; padding: 20px;">No hay ejecuciones aún</div>';
            return;
        }

        container.innerHTML = this.executions.slice(-10).reverse().map(exec => `
            <div class="dca-execution dca-completed">
                <div>
                    <strong>${exec.date.toLocaleDateString()}</strong><br>
                    ${exec.quantity.toFixed(6)} @ $${exec.price.toFixed(2)}
                </div>
                <div>$${exec.amount.toFixed(2)}</div>
            </div>
        `).join('');
    }

    loadData() {
        const data = DataManager.loadData('dcaBotData');
        if (data) {
            this.totalInvested = data.totalInvested || 0;
            this.totalQuantity = data.totalQuantity || 0;
            this.averagePrice = data.averagePrice || 0;
            this.executions = data.executions || [];
        }
    }

    saveData() {
        DataManager.saveData('dcaBotData', {
            totalInvested: this.totalInvested,
            totalQuantity: this.totalQuantity,
            averagePrice: this.averagePrice,
            executions: this.executions
        });
    }

    showMessage(message, type) {
        const messageArea = document.getElementById('messageArea-dca');
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
