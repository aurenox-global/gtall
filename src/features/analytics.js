/**
 * Analytics y métricas agregadas.
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class Analytics {
    constructor() {
        this.strategy = 'sma-cross';
        this.results = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const runBtn = document.getElementById('runBacktest');
        const exportBtn = document.getElementById('exportResults');
        
        if (runBtn) runBtn.addEventListener('click', () => this.runBacktest());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportResults());
        
        document.querySelectorAll('[data-strategy]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-strategy]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.strategy = e.target.dataset.strategy;
            });
        });
    }

    runBacktest() {
        const startDateElement = document.getElementById('backtest-start');
        const endDateElement = document.getElementById('backtest-end');
        const capitalElement = document.getElementById('backtest-capital');
        
        if (!startDateElement || !endDateElement || !capitalElement) {
            console.error('Backtest form elements not found');
            this.showMessage('Error: Formulario de backtest no encontrado', 'error');
            return;
        }
        
        const startDate = startDateElement.value;
        const endDate = endDateElement.value;
        const capital = parseFloat(capitalElement.value);

        // Simulate backtest results
        const results = this.simulateBacktest(this.strategy, capital);
        
        document.getElementById('backtest-roi').textContent = `+${results.roi.toFixed(1)}%`;
        document.getElementById('backtest-sharpe').textContent = results.sharpe.toFixed(2);
        document.getElementById('backtest-drawdown').textContent = `${results.drawdown.toFixed(1)}%`;
        document.getElementById('backtest-winrate').textContent = `${results.winRate.toFixed(1)}%`;
        document.getElementById('backtest-trades').textContent = results.totalTrades;
        document.getElementById('backtest-duration').textContent = `${results.avgDuration} days`;
        document.getElementById('backtest-profit-factor').textContent = results.profitFactor.toFixed(2);

        this.showMessage('Backtest ejecutado correctamente', 'success');
    }

    simulateBacktest(strategy, capital) {
        // Simulated results for demo
        return {
            roi: Math.random() * 50 + 10,
            sharpe: Math.random() * 2 + 0.5,
            drawdown: -(Math.random() * 15 + 5),
            winRate: Math.random() * 30 + 50,
            totalTrades: Math.floor(Math.random() * 100 + 50),
            avgDuration: Math.floor(Math.random() * 10 + 3),
            profitFactor: Math.random() * 2 + 1
        };
    }

    exportResults() {
        const data = {
            strategy: this.strategy,
            results: this.results,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backtest-results-${this.strategy}-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showMessage('Resultados exportados correctamente', 'success');
    }

    showMessage(message, type) {
        const messageArea = document.getElementById('messageArea-analytics');
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
