/**
 * Portfolio, valoración y gráficas.
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class PortfolioManager {
    constructor() {
        // Initialize with zeros - will load from storage if available
        this.totalValue = 0;
        this.dailyPnl = 0;
        this.totalTrades = 0;
        this.winRate = 0;
        this.sharpeRatio = 0;
        this.maxDrawdown = 0;
        this.manualDataHistory = []; // Array to store manual data entries
        
        // Performance metrics
        this.roiTotal = 0;
        this.roiAnnual = 0;
        this.volatility = 0;
        this.bestTrade = 0;
        this.worstTrade = 0;
        this.avgTrade = 0;
        
        this.init();
    }

    init() {
        this.loadData(); // Load saved data first
        
        // Calculate initial portfolio values synchronously
        this.calculateRealTimePortfolioValuesSync();
        
        // Calculate initial performance metrics
        this.calculatePerformanceMetrics();
        
        this.updateMetrics();
        this.initializeChart();
        
        // Update portfolio values every 30 seconds
        setInterval(() => this.updateMetrics(), 30000);
        
        // Update crypto prices every 5 minutes
        setInterval(async () => {
            await this.calculateRealTimePortfolioValues();
            this.updateMetrics();
        }, 300000);
    }

    loadData() {
        const savedData = DataManager.loadData('portfolioData');
        if (savedData && Object.keys(savedData).length > 0) {
            // Only load if there's actual data (not empty object from reset)
            this.totalValue = savedData.totalValue || 0;
            this.dailyPnl = savedData.dailyPnl || 0;
            this.totalTrades = savedData.totalTrades || 0;
            this.winRate = savedData.winRate || 0;
            this.sharpeRatio = savedData.sharpeRatio || 0;
            this.maxDrawdown = savedData.maxDrawdown || 0;
            this.manualDataHistory = savedData.manualDataHistory || [];
            
            // Load performance metrics
            this.roiTotal = savedData.roiTotal || 0;
            this.roiAnnual = savedData.roiAnnual || 0;
            this.volatility = savedData.volatility || 0;
            this.bestTrade = savedData.bestTrade || 0;
            this.worstTrade = savedData.worstTrade || 0;
            this.avgTrade = savedData.avgTrade || 0;
            
            console.log('Portfolio data loaded from storage');
        } else {
            console.log('No portfolio data found, starting with zeros');
        }
    }

    saveData() {
        const dataToSave = {
            totalValue: this.totalValue,
            dailyPnl: this.dailyPnl,
            totalTrades: this.totalTrades,
            winRate: this.winRate,
            sharpeRatio: this.sharpeRatio,
            maxDrawdown: this.maxDrawdown,
            manualDataHistory: this.manualDataHistory,
            
            // Save performance metrics
            roiTotal: this.roiTotal,
            roiAnnual: this.roiAnnual,
            volatility: this.volatility,
            bestTrade: this.bestTrade,
            worstTrade: this.worstTrade,
            avgTrade: this.avgTrade,
            
            lastSaved: new Date().toISOString()
        };
        DataManager.saveData('portfolioData', dataToSave);
    }

    updateMetrics() {
        // Calculate real-time portfolio values from crypto investments
        this.calculateRealTimePortfolioValues();
        
        // Calculate performance metrics
        this.calculatePerformanceMetrics();
        
        // Update display elements
        const totalValueEl = document.getElementById('portfolio-total-value');
        const dailyPnlEl = document.getElementById('portfolio-daily-pnl');
        const totalTradesEl = document.getElementById('portfolio-total-trades');
        const winRateEl = document.getElementById('portfolio-win-rate');
        const sharpeEl = document.getElementById('portfolio-sharpe');
        const drawdownEl = document.getElementById('portfolio-drawdown');
        
        if (totalValueEl) totalValueEl.textContent = `$${this.totalValue.toFixed(2)}`;
        if (dailyPnlEl) dailyPnlEl.textContent = `${this.dailyPnl >= 0 ? '+' : ''}$${this.dailyPnl.toFixed(2)}`;
        if (totalTradesEl) totalTradesEl.textContent = this.totalTrades;
        if (winRateEl) winRateEl.textContent = `${this.winRate.toFixed(1)}%`;
        if (sharpeEl) sharpeEl.textContent = this.sharpeRatio.toFixed(2);
        if (drawdownEl) drawdownEl.textContent = `${this.maxDrawdown.toFixed(1)}%`;

        // Update performance metrics display
        this.updatePerformanceMetricsDisplay();
        
        // Update risk management display
        this.updateRiskManagementDisplay();

        // Update manual data history display
        this.updateManualDataHistoryDisplay();
        
        // Update holdings display
        this.updateHoldingsDisplay();
        
        // Update current chart to reflect new values
        this.refreshCurrentChart();
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshPortfolio');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Manual refresh - syncing portfolio and charts...');
                this.updateMetrics(); // Esto ahora también actualizará la gráfica
                this.showMessage('Portfolio y gráficas actualizadas', 'success');
            });
        }

        // Add Manual Data button
        const addManualDataBtn = document.getElementById('addManualData');
        if (addManualDataBtn) {
            addManualDataBtn.addEventListener('click', () => this.openManualDataModal());
        }

        // Reset button - NEW!
        const resetBtn = document.getElementById('resetPortfolio');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetPortfolio());
        }

        // Export button
        const exportBtn = document.getElementById('exportPortfolio');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Chart type buttons - FIXED!
        const chartBtns = document.querySelectorAll('#portfolio .chart-btn');
        console.log('Portfolio chart buttons found:', chartBtns.length);
        chartBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Chart button clicked:', e.target.dataset.chart);
                
                // Remove active class from all buttons
                chartBtns.forEach(b => b.classList.remove('active'));
                
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Update chart and show message
                const chartType = e.target.dataset.chart;
                
                // Verificar si hay inversiones para mostrar distribución
                if (chartType === 'allocation') {
                    const history = this.getManualDataHistory();
                    const cryptoInvestments = history.filter(entry => entry.cryptoInvestment && entry.cryptoInvestment.symbol);
                    
                    if (cryptoInvestments.length === 0) {
                        this.showMessage('No tienes inversiones en criptomonedas para mostrar la distribución', 'info');
                        // Reactivar el botón anterior
                        e.target.classList.remove('active');
                        const activeBtn = document.querySelector('#portfolio .chart-btn.active') || document.querySelector('#portfolio .chart-btn[data-chart="value"]');
                        if (activeBtn) activeBtn.classList.add('active');
                        return;
                    }
                }
                
                this.updateChart(chartType);
                this.showMessage(`Gráfico cambiado a: ${chartType}`, 'info');
            });
            console.log('Listener added for chart type:', btn.dataset.chart);
        });
    }

    resetPortfolio() {
        if (confirm('🗑️ ¿Estás seguro de que quieres reiniciar el portfolio?\n\nEsto pondrá todos los valores en cero y eliminará el historial de datos manuales.\n\n⚠️ Esta acción no se puede deshacer.')) {
            console.log('Resetting portfolio...');
            
            // Reset all values to zero
            this.totalValue = 0;
            this.dailyPnl = 0;
            this.totalTrades = 0;
            this.winRate = 0;
            this.sharpeRatio = 0;
            this.maxDrawdown = 0;
            this.manualDataHistory = []; // Clear manual data history
            
            // Reset performance metrics
            this.roiTotal = 0;
            this.roiAnnual = 0;
            this.volatility = 0;
            this.bestTrade = 0;
            this.worstTrade = 0;
            this.avgTrade = 0;

            // Save the reset state immediately
            this.saveData();
            
            // Also clear with empty object as backup
            localStorage.removeItem('portfolioData');
            
            // Force update display
            this.updateMetrics();
            
            // Reinitialize chart with zero data
            if (this.chart) {
                this.chart.destroy();
            }
            this.updateChart('value');
            
            this.showMessage('Portfolio reiniciado exitosamente - Todos los datos en cero', 'success');
            console.log('Portfolio reset completed - all values set to zero');
            console.log('Current values:', {
                totalValue: this.totalValue,
                dailyPnl: this.dailyPnl,
                totalTrades: this.totalTrades,
                winRate: this.winRate
            });
        }
    }

    updateChart(chartType = 'value') {
        const canvas = document.getElementById('portfolioChart');
        if (!canvas) {
            console.error('Portfolio chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        
        // Clear existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        console.log('Creating chart for type:', chartType);

        let chartConfig;

        switch (chartType) {
            case 'value':
                // Generar datos más llamativos con picos y valles
                const valueData = this.generatePortfolioValueData();
                
                chartConfig = {
                    type: 'line',
                    data: {
                        labels: valueData.labels,
                        datasets: [{
                            label: 'Valor del Portfolio ($)',
                            data: valueData.values,
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.15)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: '#3498db',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 5,
                            pointHoverRadius: 8,
                            pointHoverBackgroundColor: '#3498db',
                            pointHoverBorderColor: '#ffffff',
                            pointHoverBorderWidth: 3,
                            shadowColor: 'rgba(52, 152, 219, 0.5)',
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowOffsetY: 5
                        }]
                    }
                };
                break;
            case 'pnl':
                // Generar datos realistas de PnL con fluctuaciones
                const pnlData = this.generatePnLData();
                
                chartConfig = {
                    type: 'line',
                    data: {
                        labels: pnlData.labels,
                        datasets: [{
                            label: 'PnL Acumulado ($)',
                            data: pnlData.values,
                            borderColor: this.dailyPnl >= 0 ? '#2ecc71' : '#e74c3c',
                            backgroundColor: this.dailyPnl >= 0 ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.3,
                            pointBackgroundColor: pnlData.values.map(val => val >= 0 ? '#2ecc71' : '#e74c3c'),
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                            pointHoverBorderWidth: 3,
                            segment: {
                                borderColor: ctx => {
                                    const current = ctx.p1.parsed.y;
                                    const previous = ctx.p0.parsed.y;
                                    return current >= previous ? '#2ecc71' : '#e74c3c';
                                },
                                backgroundColor: ctx => {
                                    const current = ctx.p1.parsed.y;
                                    return current >= 0 ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)';
                                }
                            }
                        }]
                    }
                };
                break;
            case 'allocation':
                // Obtener datos reales de inversiones
                const allocationData = this.getAllocationData();
                
                chartConfig = {
                    type: 'doughnut',
                    data: {
                        labels: allocationData.labels,
                        datasets: [{
                            data: allocationData.values,
                            backgroundColor: allocationData.colors,
                            borderWidth: 2,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            hoverBorderWidth: 3,
                            hoverBorderColor: 'rgba(255, 255, 255, 0.8)'
                        }]
                    }
                };
                break;
            default:
                chartType = 'value';
                chartConfig = {
                    type: 'line',
                    data: {
                        labels: ['Inicio', 'Ahora'],
                        datasets: [{
                            label: 'Valor del Portfolio ($)',
                            data: [2000, this.totalValue],
                            borderColor: '#3498db',
                            backgroundColor: 'rgba(52, 152, 219, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            tension: 0.4
                        }]
                    }
                };
        }

        // Common chart options
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { 
                    labels: { 
                        color: '#ecf0f1',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3498db',
                    borderWidth: 2,
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: (tooltipItems) => {
                            return tooltipItems[0].label;
                        },
                        label: (tooltipItem) => {
                            const value = tooltipItem.parsed.y;
                            return `${tooltipItem.dataset.label}: $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutCubic',
                animateRotate: true,
                animateScale: true
            },
            elements: {
                point: {
                    hoverRadius: 8
                }
            }
        };

        if (chartType !== 'allocation') {
            commonOptions.scales = {
                x: {
                    ticks: { 
                        color: '#bdc3c7',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    },
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.1)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                y: {
                    ticks: { 
                        color: '#bdc3c7',
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    },
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.1)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    },
                    beginAtZero: chartType === 'pnl' ? false : true
                }
            };
        }

        chartConfig.options = commonOptions;

        try {
            this.chart = new Chart(ctx, chartConfig);
            console.log(`Chart created successfully for type: ${chartType}`);
        } catch (error) {
            console.error('Error creating chart:', error);
        }
    }

    exportData() {
        const exportData = {
            totalValue: this.totalValue,
            dailyPnl: this.dailyPnl,
            totalTrades: this.totalTrades,
            winRate: this.winRate,
            sharpeRatio: this.sharpeRatio,
            maxDrawdown: this.maxDrawdown,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-export-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showMessage('Portfolio exportado exitosamente', 'success');
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ${type === 'success' ? 'background: linear-gradient(45deg, #27ae60, #2ecc71);' : 
              type === 'error' ? 'background: linear-gradient(45deg, #e74c3c, #c0392b);' : 
              'background: linear-gradient(45deg, #3498db, #2980b9);'}
        `;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    generatePortfolioValueData() {
        // Usar el valor real del portfolio
        const currentPortfolioValue = this.totalValue > 0 ? this.totalValue : 0; // Valor actual del portfolio
        const periods = 15; // Número de puntos de datos
        
        const labels = [];
        const values = [];
        
        // Generar etiquetas de tiempo
        const now = new Date();
        for (let i = periods - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // Días atrás
            labels.push(date.toLocaleDateString('es-ES', { 
                month: 'short', 
                day: 'numeric' 
            }));
        }

        if (currentPortfolioValue === 0) {
            labels.forEach(() => values.push(0));
            return { labels, values };
        }
        
        // Valor inicial (hace 15 días) - empezar con 80% del valor actual
        const initialValue = currentPortfolioValue * 0.8;
        
        // Calcular incremento base hacia el valor final
        const baseIncrement = (currentPortfolioValue - initialValue) / (periods - 1);
        
        let currentValue = initialValue;
        
        for (let i = 0; i < periods; i++) {
            // Para el último punto, usar exactamente el valor del portfolio
            if (i === periods - 1) {
                values.push(currentPortfolioValue);
            } else {
                // Agregar volatilidad realista pero controlada
                const volatility = 0.12; // 12% de volatilidad máxima
                const randomFactor = (Math.random() - 0.5) * 2 * volatility;
                
                // Calcular valor base con tendencia
                const baseValue = initialValue + (baseIncrement * i);
                
                // Aplicar volatilidad al valor base
                currentValue = baseValue * (1 + randomFactor);
                
                // Asegurar que no sea menor a 100 y no se desvíe demasiado del objetivo
                currentValue = Math.max(currentValue, 0);
                currentValue = Math.min(currentValue, currentPortfolioValue * 1.3);
                
                values.push(currentValue);
            }
        }
        
        console.log('Portfolio Value Chart - Current Total:', currentPortfolioValue, 'Chart End Value:', values[values.length - 1]);
        
        return { labels, values };
    }

    generatePnLData() {
        // Usar el PnL real del portfolio
        const currentPnL = this.dailyPnl || 0; // PnL actual del portfolio
        const periods = 15;
        const labels = [];
        const values = [];
        
        // Generar etiquetas de tiempo
        const now = new Date();
        for (let i = periods - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            labels.push(date.toLocaleDateString('es-ES', { 
                month: 'short', 
                day: 'numeric' 
            }));
        }
        
        // Valor inicial del PnL (hace 15 días) - empezar desde 0 o un valor menor
        const initialPnL = currentPnL * 0.3; // Empezar con 30% del PnL actual
        
        // Calcular incremento base hacia el PnL final
        const baseIncrement = (currentPnL - initialPnL) / (periods - 1);
        
        for (let i = 0; i < periods; i++) {
            // Para el último punto, usar exactamente el PnL del portfolio
            if (i === periods - 1) {
                values.push(currentPnL);
            } else {
                // Calcular valor base con tendencia progresiva
                const baseValue = initialPnL + (baseIncrement * i);
                
                // Agregar volatilidad controlada
                const volatility = 0.15; // 15% de volatilidad
                const maxDaily = Math.abs(currentPnL) * 0.1 || 50; // 10% del PnL total o mínimo 50
                const randomFactor = (Math.random() - 0.5) * 2 * volatility * maxDaily;
                
                const dailyPnL = baseValue + randomFactor;
                values.push(dailyPnL);
            }
        }
        
        console.log('PnL Chart - Current PnL:', currentPnL, 'Chart End Value:', values[values.length - 1]);
        
        return { labels, values };
    }

    getAllocationData() {
        const history = this.getManualDataHistory();
        const cryptoInvestments = history.filter(entry => entry.cryptoInvestment && entry.cryptoInvestment.symbol);

        if (cryptoInvestments.length === 0) {
            return {
                labels: ['Sin inversiones'],
                values: [100],
                colors: ['#95a5a6']
            };
        }

        // Agrupar inversiones por símbolo y calcular totales
        const holdings = {};
        let totalValue = 0;

        cryptoInvestments.forEach(entry => {
            const crypto = entry.cryptoInvestment;
            const symbol = crypto.symbol;
            const currentValue = crypto.currentValue || (crypto.quantity * crypto.currentPrice) || 0;
            
            if (!holdings[symbol]) {
                holdings[symbol] = 0;
            }
            
            holdings[symbol] += currentValue;
            totalValue += currentValue;
        });

        // Colores para diferentes criptomonedas
        const cryptoColors = {
            'BTCUSDT': '#f39c12',
            'ETHUSDT': '#3498db', 
            'BNBUSDT': '#f1c40f',
            'ADAUSDT': '#2ecc71',
            'XRPUSDT': '#9b59b6',
            'SOLUSDT': '#e67e22',
            'DOGEUSDT': '#f39c12',
            'DOTUSDT': '#e91e63',
            'MATICUSDT': '#8e44ad',
            'LTCUSDT': '#95a5a6'
        };

        const labels = Object.keys(holdings);
        const values = labels.map(symbol => 
            totalValue > 0 ? ((holdings[symbol] / totalValue) * 100).toFixed(1) : 0
        );
        const colors = labels.map(symbol => 
            cryptoColors[symbol] || `hsl(${Math.random() * 360}, 70%, 60%)`
        );

        return {
            labels: labels,
            values: values,
            colors: colors
        };
    }

    updateHoldingsDisplay() {
        const holdingsContainer = document.getElementById('portfolio-holdings');
        if (!holdingsContainer) return;

        const history = this.getManualDataHistory();
        const cryptoInvestments = history.filter(entry => entry.cryptoInvestment && entry.cryptoInvestment.symbol);

        if (cryptoInvestments.length === 0) {
            holdingsContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #bdc3c7;">
                    <div style="font-size: 48px; margin-bottom: 16px;">💼</div>
                    <p style="font-size: 18px; margin-bottom: 8px;">No tienes inversiones en criptomonedas</p>
                    <p style="font-size: 14px;">Agrega datos para ver tus holdings aquí</p>
                </div>
            `;
            return;
        }

        // Agrupar inversiones por símbolo y calcular totales
        const holdings = {};
        cryptoInvestments.forEach(entry => {
            const crypto = entry.cryptoInvestment;
            const symbol = crypto.symbol;
            
            if (!holdings[symbol]) {
                holdings[symbol] = {
                    symbol: symbol,
                    totalQuantity: 0,
                    totalInvestment: 0,
                    totalCurrentValue: 0,
                    avgEntryPrice: 0,
                    currentPrice: crypto.currentPrice || 0,
                    totalUnrealizedPnl: 0,
                    entries: []
                };
            }
            
            holdings[symbol].totalQuantity += crypto.quantity;
            holdings[symbol].totalInvestment += crypto.totalInvestment || (crypto.quantity * crypto.entryPrice);
            holdings[symbol].totalCurrentValue += crypto.currentValue || (crypto.quantity * crypto.currentPrice);
            holdings[symbol].totalUnrealizedPnl += crypto.unrealizedPnl || 0;
            holdings[symbol].entries.push(crypto);
        });

        // Calcular precio promedio de entrada para cada holding
        Object.keys(holdings).forEach(symbol => {
            const holding = holdings[symbol];
            holding.avgEntryPrice = holding.totalInvestment / holding.totalQuantity;
        });

        holdingsContainer.innerHTML = Object.values(holdings).map(holding => {
            const pnlPercentage = holding.totalInvestment > 0 ? 
                (holding.totalUnrealizedPnl / holding.totalInvestment) * 100 : 0;
            
            const pnlClass = holding.totalUnrealizedPnl >= 0 ? '#2ecc71' : '#e74c3c';
            const pnlIcon = holding.totalUnrealizedPnl >= 0 ? '📈' : '📉';
            const pnlSign = holding.totalUnrealizedPnl >= 0 ? '+' : '';
            
            return `
                <div class="holding-card" style="background: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 16px; border-left: 4px solid #f39c12;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center;">
                            <div style="font-size: 32px; margin-right: 16px;">🪙</div>
                            <div>
                                <h3 style="color: #f39c12; margin: 0; font-size: 20px;">${holding.symbol}</h3>
                                <p style="color: #bdc3c7; margin: 0; font-size: 14px;">${holding.totalQuantity.toFixed(6)} monedas</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 18px; font-weight: bold; color: #ecf0f1;">
                                $${holding.totalCurrentValue.toFixed(2)}
                            </div>
                            <div style="font-size: 14px; color: ${pnlClass};">
                                ${pnlIcon} ${pnlSign}$${Math.abs(holding.totalUnrealizedPnl).toFixed(2)} (${pnlSign}${pnlPercentage.toFixed(2)}%)
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                        <div>
                            <div style="font-size: 12px; color: #95a5a6; margin-bottom: 4px;">PRECIO ENTRADA PROMEDIO</div>
                            <div style="font-size: 16px; font-weight: bold; color: #ecf0f1;">$${holding.avgEntryPrice.toFixed(2)}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #95a5a6; margin-bottom: 4px;">PRECIO ACTUAL</div>
                            <div style="font-size: 16px; font-weight: bold; color: #3498db;">$${holding.currentPrice.toFixed(2)}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #95a5a6; margin-bottom: 4px;">INVERSIÓN TOTAL</div>
                            <div style="font-size: 16px; font-weight: bold; color: #ecf0f1;">$${holding.totalInvestment.toFixed(2)}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #95a5a6; margin-bottom: 4px;"># ENTRADAS</div>
                            <div style="font-size: 16px; font-weight: bold; color: #f39c12;">${holding.entries.length}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    refreshCurrentChart() {
        // Detectar qué tipo de gráfica está actualmente activa
        const activeChartBtn = document.querySelector('#portfolio .chart-btn.active');
        if (activeChartBtn && activeChartBtn.dataset.chart) {
            const currentChartType = activeChartBtn.dataset.chart;
            console.log('Refreshing chart:', currentChartType);
            this.updateChart(currentChartType);
        }
    }

    initializeChart() {
        this.setupEventListeners();
        this.updateChart('value');
    }

    // Manual Data Methods
    openManualDataModal() {
        const modal = document.getElementById('manualDataModal');
        if (modal) {
            // Set current date as default
            const now = new Date();
            const dateTimeLocal = now.toISOString().slice(0, 16);
            const dateInput = document.getElementById('manualDate');
            if (dateInput) {
                dateInput.value = dateTimeLocal;
            }
            
            // Pre-fill with current values if they exist
            const totalValueInput = document.getElementById('manualTotalValue');
            const dailyPnlInput = document.getElementById('manualDailyPnl');
            const totalTradesInput = document.getElementById('manualTotalTrades');
            const winRateInput = document.getElementById('manualWinRate');
            const sharpeInput = document.getElementById('manualSharpeRatio');
            const drawdownInput = document.getElementById('manualMaxDrawdown');
            
            if (totalValueInput && this.totalValue > 0) totalValueInput.value = this.totalValue.toFixed(2);
            if (dailyPnlInput && this.dailyPnl !== 0) dailyPnlInput.value = this.dailyPnl.toFixed(2);
            if (totalTradesInput && this.totalTrades > 0) totalTradesInput.value = this.totalTrades;
            if (winRateInput && this.winRate > 0) winRateInput.value = this.winRate.toFixed(1);
            if (sharpeInput && this.sharpeRatio !== 0) sharpeInput.value = this.sharpeRatio.toFixed(2);
            if (drawdownInput && this.maxDrawdown > 0) drawdownInput.value = this.maxDrawdown.toFixed(1);
            
            modal.style.display = 'flex';
        }
    }

    closeManualDataModal() {
        const modal = document.getElementById('manualDataModal');
        if (modal) {
            modal.style.display = 'none';
            // Clear form
            const form = modal.querySelector('.modal-body');
            if (form) {
                const inputs = form.querySelectorAll('input, textarea');
                inputs.forEach(input => {
                    if (input.type !== 'datetime-local') {
                        input.value = '';
                    }
                });
            }
        }
    }

    saveManualData() {
        // Get crypto investment data
        const cryptoSymbol = document.getElementById('cryptoSymbol')?.value || '';
        const cryptoQuantity = parseFloat(document.getElementById('cryptoQuantity')?.value) || 0;
        const entryPrice = parseFloat(document.getElementById('entryPrice')?.value) || 0;
        const currentPrice = parseFloat(document.getElementById('currentPrice')?.value) || 0;
        const totalInvestment = parseFloat(document.getElementById('totalInvestment')?.value) || 0;
        const currentValue = parseFloat(document.getElementById('currentValue')?.value) || 0;
        const unrealizedPnl = parseFloat(document.getElementById('unrealizedPnl')?.value) || 0;

        // Get portfolio summary data
        const totalValue = parseFloat(document.getElementById('manualTotalValue')?.value) || 0;
        const dailyPnl = parseFloat(document.getElementById('manualDailyPnl')?.value) || 0;
        const totalTrades = parseInt(document.getElementById('manualTotalTrades')?.value) || 0;
        const winRate = parseFloat(document.getElementById('manualWinRate')?.value) || 0;
        const sharpeRatio = parseFloat(document.getElementById('manualSharpeRatio')?.value) || 0;
        const maxDrawdown = parseFloat(document.getElementById('manualMaxDrawdown')?.value) || 0;
        const date = document.getElementById('manualDate')?.value || new Date().toISOString();
        const notes = document.getElementById('manualNotes')?.value || '';

        // Validate required fields
        if (totalValue <= 0) {
            this.showMessage('El valor total del portfolio debe ser mayor a 0', 'error');
            return;
        }

        // Create manual data entry with crypto info
        const manualEntry = {
            id: Date.now(),
            totalValue: totalValue,
            dailyPnl: dailyPnl,
            totalTrades: totalTrades,
            winRate: winRate,
            sharpeRatio: sharpeRatio,
            maxDrawdown: maxDrawdown,
            date: date,
            notes: notes,
            timestamp: new Date().toISOString(),
            
            // Crypto investment data
            cryptoInvestment: {
                symbol: cryptoSymbol,
                quantity: cryptoQuantity,
                entryPrice: entryPrice,
                currentPrice: currentPrice,
                totalInvestment: totalInvestment,
                currentValue: currentValue,
                unrealizedPnl: unrealizedPnl
            }
        };

        // Add to history
        this.manualDataHistory.push(manualEntry);

        // Update current portfolio values
        this.totalValue = totalValue;
        this.dailyPnl = dailyPnl;
        this.totalTrades = totalTrades;
        this.winRate = winRate;
        this.sharpeRatio = sharpeRatio;
        this.maxDrawdown = maxDrawdown;

        // Save data
        this.saveData();
        
        // Update portfolio values in real-time
        this.calculateRealTimePortfolioValuesSync();
        
        // Recalculate performance metrics
        this.calculatePerformanceMetrics();
        
        // Update all displays
        this.updateMetrics(); // Esto ya actualizará la gráfica activa automáticamente

        // Close modal
        this.closeManualDataModal();

        this.showMessage('Datos manuales guardados exitosamente', 'success');
        console.log('Manual data saved:', manualEntry);
    }

    getManualDataHistory() {
        return this.manualDataHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    deleteManualDataEntry(entryId) {
        const index = this.manualDataHistory.findIndex(entry => entry.id === entryId);
        if (index !== -1) {
            this.manualDataHistory.splice(index, 1);
            this.saveData();
            this.showMessage('Entrada de datos eliminada', 'success');
            return true;
        }
        return false;
    }

    updateManualDataHistoryDisplay() {
        const historyContainer = document.getElementById('manual-data-history');
        if (!historyContainer) return;

        const history = this.getManualDataHistory();
        
        if (history.length === 0) {
            historyContainer.innerHTML = `
                <div style="text-align: center; color: #bdc3c7; padding: 20px;">
                    No hay datos manuales registrados
                </div>
            `;
            return;
        }

        // Show only the 3 most recent entries
        const recentEntries = history.slice(0, 3);
        
        historyContainer.innerHTML = recentEntries.map(entry => {
            const date = new Date(entry.date).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const pnlClass = entry.dailyPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            const pnlSign = entry.dailyPnl >= 0 ? '+' : '';
            
            // Add crypto info if available
            let cryptoInfo = '';
            if (entry.cryptoInvestment && entry.cryptoInvestment.symbol) {
                const crypto = entry.cryptoInvestment;
                const cryptoPnlClass = crypto.unrealizedPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
                const cryptoPnlSign = crypto.unrealizedPnl >= 0 ? '+' : '';
                
                cryptoInfo = `
                    <div style="margin-top: 8px; padding: 8px; background: rgba(52, 152, 219, 0.1); border-radius: 6px; border-left: 3px solid #3498db;">
                        <div style="font-size: 12px; color: #3498db; margin-bottom: 4px;">
                            🪙 ${crypto.symbol} | ${crypto.quantity} monedas
                        </div>
                        <div style="font-size: 11px; color: #bdc3c7;">
                            Entrada: $${crypto.entryPrice} | Actual: $${crypto.currentPrice}
                        </div>
                        <div style="font-size: 12px; font-weight: bold; ${cryptoPnlClass}; margin-top: 4px;">
                            ${cryptoPnlSign}$${crypto.unrealizedPnl.toFixed(2)} (${((crypto.unrealizedPnl / crypto.totalInvestment) * 100).toFixed(2)}%)
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="holding-item">
                    <div class="holding-info">
                        <div class="holding-icon" style="background: linear-gradient(135deg, #3498db, #2980b9);">📊</div>
                        <div class="holding-details">
                            <h4>${date}</h4>
                            <p>Valor: $${entry.totalValue.toFixed(2)} | Trades: ${entry.totalTrades}</p>
                            ${cryptoInfo}
                        </div>
                    </div>
                    <div class="holding-value">
                        <div class="holding-amount ${pnlClass}">${pnlSign}$${entry.dailyPnl.toFixed(2)}</div>
                        <div class="holding-percentage">Win Rate: ${entry.winRate.toFixed(1)}%</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add "View All" message if there are more entries
        if (history.length > 3) {
            historyContainer.innerHTML += `
                <div style="text-align: center; color: #3498db; padding: 10px; font-size: 12px;">
                    +${history.length - 3} entradas más. Haz clic en "Ver Todo" para ver el historial completo.
                </div>
            `;
        }
    }

    // Performance Metrics Calculation Methods
    calculatePerformanceMetrics() {
        const history = this.getManualDataHistory();
        
        if (history.length === 0) {
            // Use current values if no history
            this.calculateMetricsFromCurrentValues();
            return;
        }

        // Calculate from historical data
        this.calculateMetricsFromHistory(history);
    }

    calculateMetricsFromCurrentValues() {
        // Calculate ROI Total (use current value as baseline when no history exists)
        const initialInvestment = this.totalValue > 0 ? this.totalValue : 0;
        this.roiTotal = initialInvestment > 0 ? ((this.totalValue - initialInvestment) / initialInvestment) * 100 : 0;
        
        // Calculate Annualized ROI (assuming 1 year period)
        this.roiAnnual = this.roiTotal;
        
        // Calculate Sharpe Ratio (simplified)
        this.sharpeRatio = this.calculateSharpeRatio();
        
        // Calculate Max Drawdown
        this.maxDrawdown = this.calculateMaxDrawdown();
        
        // Calculate Volatility
        this.volatility = this.calculateVolatility();
        
        // Calculate Best/Worst/Average Trade
        this.bestTrade = this.dailyPnl > 0 ? this.dailyPnl : 0;
        this.worstTrade = this.dailyPnl < 0 ? this.dailyPnl : 0;
        this.avgTrade = this.totalTrades > 0 ? this.dailyPnl / this.totalTrades : 0;
    }

    calculateMetricsFromHistory(history) {
        if (history.length < 2) {
            this.calculateMetricsFromCurrentValues();
            return;
        }

        // Sort by date
        const sortedHistory = history.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate ROI Total
        const firstEntry = sortedHistory[0];
        const lastEntry = sortedHistory[sortedHistory.length - 1];
        const initialValue = firstEntry.totalValue;
        const finalValue = lastEntry.totalValue;
        this.roiTotal = ((finalValue - initialValue) / initialValue) * 100;
        
        // Calculate Annualized ROI
        const firstDate = new Date(firstEntry.date);
        const lastDate = new Date(lastEntry.date);
        const yearsDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365.25);
        this.roiAnnual = yearsDiff > 0 ? Math.pow((1 + this.roiTotal / 100), 1 / yearsDiff) - 1 : this.roiTotal;
        this.roiAnnual *= 100;
        
        // Calculate Sharpe Ratio
        this.sharpeRatio = this.calculateSharpeRatioFromHistory(sortedHistory);
        
        // Calculate Max Drawdown
        this.maxDrawdown = this.calculateMaxDrawdownFromHistory(sortedHistory);
        
        // Calculate Volatility
        this.volatility = this.calculateVolatilityFromHistory(sortedHistory);
        
        // Calculate Best/Worst/Average Trade
        const pnlValues = sortedHistory.map(entry => entry.dailyPnl);
        this.bestTrade = Math.max(...pnlValues);
        this.worstTrade = Math.min(...pnlValues);
        this.avgTrade = pnlValues.reduce((sum, val) => sum + val, 0) / pnlValues.length;
    }

    calculateSharpeRatio() {
        // Simplified Sharpe Ratio calculation
        if (this.dailyPnl === 0 || this.volatility === 0) return 0;
        const riskFreeRate = 0.02; // 2% annual risk-free rate
        return ((this.dailyPnl * 365 - riskFreeRate) / this.volatility);
    }

    calculateSharpeRatioFromHistory(history) {
        if (history.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < history.length; i++) {
            const prevValue = history[i-1].totalValue;
            const currValue = history[i].totalValue;
            const dailyReturn = (currValue - prevValue) / prevValue;
            returns.push(dailyReturn);
        }
        
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev === 0) return 0;
        
        const riskFreeRate = 0.02 / 365; // Daily risk-free rate
        return (avgReturn - riskFreeRate) / stdDev;
    }

    calculateMaxDrawdown() {
        // Simplified max drawdown calculation
        return this.maxDrawdown || 0;
    }

    calculateMaxDrawdownFromHistory(history) {
        if (history.length < 2) return 0;
        
        let maxValue = history[0].totalValue;
        let maxDrawdown = 0;
        
        for (const entry of history) {
            if (entry.totalValue > maxValue) {
                maxValue = entry.totalValue;
            }
            
            const drawdown = (maxValue - entry.totalValue) / maxValue * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        
        return maxDrawdown;
    }

    calculateVolatility() {
        // Simplified volatility calculation
        return this.volatility || 0;
    }

    calculateVolatilityFromHistory(history) {
        if (history.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < history.length; i++) {
            const prevValue = history[i-1].totalValue;
            const currValue = history[i].totalValue;
            const dailyReturn = (currValue - prevValue) / prevValue;
            returns.push(dailyReturn);
        }
        
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        // Convert to annualized volatility
        return stdDev * Math.sqrt(365) * 100;
    }

    // Real-time portfolio calculation methods
    async calculateRealTimePortfolioValues() {
        const history = this.getManualDataHistory();
        let totalPortfolioValue = 0;
        let totalUnrealizedPnl = 0;
        let hasCryptoInvestments = false;

        // Calculate from crypto investments
        for (const entry of history) {
            if (entry.cryptoInvestment && entry.cryptoInvestment.symbol) {
                hasCryptoInvestments = true;
                
                try {
                    // Get current price from Binance API
                    const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${entry.cryptoInvestment.symbol}`);
                    const data = await response.json();
                    
                    if (data.price) {
                        const currentPrice = parseFloat(data.price);
                        const quantity = entry.cryptoInvestment.quantity;
                        const entryPrice = entry.cryptoInvestment.entryPrice;
                        
                        // Calculate current value
                        const currentValue = quantity * currentPrice;
                        const unrealizedPnl = currentValue - (quantity * entryPrice);
                        
                        // Update entry with current data
                        entry.cryptoInvestment.currentPrice = currentPrice;
                        entry.cryptoInvestment.currentValue = currentValue;
                        entry.cryptoInvestment.unrealizedPnl = unrealizedPnl;
                        
                        // Add to totals
                        totalPortfolioValue += currentValue;
                        totalUnrealizedPnl += unrealizedPnl;
                    }
                } catch (error) {
                    console.error(`Error fetching price for ${entry.cryptoInvestment.symbol}:`, error);
                    // Use stored values if API fails
                    totalPortfolioValue += entry.cryptoInvestment.currentValue || 0;
                    totalUnrealizedPnl += entry.cryptoInvestment.unrealizedPnl || 0;
                }
            }
        }

        // If no crypto investments, use manual values
        if (!hasCryptoInvestments) {
            totalPortfolioValue = this.totalValue;
            totalUnrealizedPnl = this.dailyPnl;
        }

        // Update portfolio values
        this.totalValue = totalPortfolioValue;
        this.dailyPnl = totalUnrealizedPnl;

        // Save updated data
        this.saveData();
    }

    // Synchronous version for immediate updates
    calculateRealTimePortfolioValuesSync() {
        const history = this.getManualDataHistory();
        let totalPortfolioValue = 0;
        let totalUnrealizedPnl = 0;
        let hasCryptoInvestments = false;

        // Calculate from stored crypto data (without API calls)
        for (const entry of history) {
            if (entry.cryptoInvestment && entry.cryptoInvestment.symbol) {
                hasCryptoInvestments = true;
                totalPortfolioValue += entry.cryptoInvestment.currentValue || 0;
                totalUnrealizedPnl += entry.cryptoInvestment.unrealizedPnl || 0;
            }
        }

        // If no crypto investments, use manual values
        if (!hasCryptoInvestments) {
            totalPortfolioValue = this.totalValue;
            totalUnrealizedPnl = this.dailyPnl;
        }

        // Update portfolio values
        this.totalValue = totalPortfolioValue;
        this.dailyPnl = totalUnrealizedPnl;
    }

    updatePerformanceMetricsDisplay() {
        // Update ROI Total
        const roiTotalEl = document.getElementById('portfolio-roi-total');
        if (roiTotalEl) {
            roiTotalEl.textContent = `${this.roiTotal ? this.roiTotal.toFixed(2) : '0.00'}%`;
        }

        // Update ROI Annualized
        const roiAnnualEl = document.getElementById('portfolio-roi-annual');
        if (roiAnnualEl) {
            roiAnnualEl.textContent = `${this.roiAnnual ? this.roiAnnual.toFixed(2) : '0.00'}%`;
        }

        // Update Sharpe Ratio
        const sharpeEl = document.getElementById('portfolio-sharpe');
        if (sharpeEl) {
            sharpeEl.textContent = this.sharpeRatio ? this.sharpeRatio.toFixed(2) : '0.00';
        }

        // Update Max Drawdown
        const drawdownEl = document.getElementById('portfolio-drawdown');
        if (drawdownEl) {
            drawdownEl.textContent = `${this.maxDrawdown ? this.maxDrawdown.toFixed(1) : '0.0'}%`;
        }

        // Update Volatility
        const volatilityEl = document.getElementById('portfolio-volatility');
        if (volatilityEl) {
            volatilityEl.textContent = `${this.volatility ? this.volatility.toFixed(2) : '0.00'}%`;
        }

        // Update Best Trade
        const bestTradeEl = document.getElementById('portfolio-best-trade');
        if (bestTradeEl) {
            bestTradeEl.textContent = `$${this.bestTrade ? this.bestTrade.toFixed(2) : '0.00'}`;
        }

        // Update Worst Trade
        const worstTradeEl = document.getElementById('portfolio-worst-trade');
        if (worstTradeEl) {
            worstTradeEl.textContent = `$${this.worstTrade ? this.worstTrade.toFixed(2) : '0.00'}`;
        }

        // Update Average Trade
        const avgTradeEl = document.getElementById('portfolio-avg-trade');
        if (avgTradeEl) {
            avgTradeEl.textContent = `$${this.avgTrade ? this.avgTrade.toFixed(2) : '0.00'}`;
        }
    }

    updateRiskManagementDisplay() {
        // Calculate risk level based on volatility and drawdown
        let riskLevel = 'Bajo';
        let riskGaugeWidth = 25;
        
        if (this.volatility > 30 || this.maxDrawdown > 20) {
            riskLevel = 'Alto';
            riskGaugeWidth = 85;
        } else if (this.volatility > 15 || this.maxDrawdown > 10) {
            riskLevel = 'Moderado';
            riskGaugeWidth = 60;
        }

        // Update Risk Level
        const riskLevelEl = document.getElementById('risk-level-value');
        if (riskLevelEl) {
            riskLevelEl.textContent = riskLevel;
        }

        const riskGaugeEl = document.getElementById('risk-level-gauge');
        if (riskGaugeEl) {
            const gaugeFill = riskGaugeEl.querySelector('.gauge-fill');
            if (gaugeFill) {
                gaugeFill.style.width = `${riskGaugeWidth}%`;
            }
        }

        // Calculate diversification score based on number of trades and consistency
        let diversificationScore = 0;
        if (this.totalTrades > 0) {
            // Base score from number of trades
            diversificationScore += Math.min(this.totalTrades * 2, 40);
            
            // Bonus for consistent performance (low volatility)
            if (this.volatility < 10) diversificationScore += 20;
            if (this.volatility < 5) diversificationScore += 15;
            
            // Bonus for good win rate
            if (this.winRate > 60) diversificationScore += 15;
            if (this.winRate > 70) diversificationScore += 10;
        }
        
        diversificationScore = Math.min(diversificationScore, 100);

        // Update Diversification
        const diversificationEl = document.getElementById('diversification-value');
        if (diversificationEl) {
            diversificationEl.textContent = `${diversificationScore}/100`;
        }

        const diversificationGaugeEl = document.getElementById('diversification-gauge');
        if (diversificationGaugeEl) {
            const gaugeFill = diversificationGaugeEl.querySelector('.gauge-fill');
            if (gaugeFill) {
                gaugeFill.style.width = `${diversificationScore}%`;
            }
        }

        // Calculate exposure based on current portfolio value vs initial
        const initialInvestment = 1000;
        const exposure = this.totalValue > 0 ? (this.totalValue / initialInvestment) * 100 : 0;

        // Update Exposure
        const exposureEl = document.getElementById('exposure-value');
        if (exposureEl) {
            exposureEl.textContent = `${exposure.toFixed(0)}%`;
        }

        const exposureGaugeEl = document.getElementById('exposure-gauge');
        if (exposureGaugeEl) {
            const gaugeFill = exposureGaugeEl.querySelector('.gauge-fill');
            if (gaugeFill) {
                gaugeFill.style.width = `${Math.min(exposure, 100)}%`;
            }
        }
    }

    showAllManualData() {
        const history = this.getManualDataHistory();
        
        if (history.length === 0) {
            this.showMessage('No hay datos manuales para mostrar', 'info');
            return;
        }

        // Create a modal to show all data
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        const tableRows = history.map(entry => {
            const date = new Date(entry.date).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const pnlClass = entry.dailyPnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            const pnlSign = entry.dailyPnl >= 0 ? '+' : '';
            
            return `
                <tr>
                    <td>${date}</td>
                    <td>$${entry.totalValue.toFixed(2)}</td>
                    <td class="${pnlClass}">${pnlSign}$${entry.dailyPnl.toFixed(2)}</td>
                    <td>${entry.totalTrades}</td>
                    <td>${entry.winRate.toFixed(1)}%</td>
                    <td>${entry.sharpeRatio.toFixed(2)}</td>
                    <td>${entry.maxDrawdown.toFixed(1)}%</td>
                    <td>
                        <button onclick="deleteManualDataEntry(${entry.id})" style="padding: 4px 8px; background: #e74c3c; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; max-height: 80vh;">
                <div class="modal-header">
                    <h3>📊 Historial Completo de Datos Manuales</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body" style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; color: white; font-size: 14px;">
                        <thead>
                            <tr style="background: rgba(255,255,255,0.1);">
                                <th style="padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">Fecha</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">Valor Total</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">PnL Diario</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">Trades</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">Win Rate</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">Sharpe</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">Drawdown</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.2);">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn-start" onclick="exportManualDataHistory()">📊 Exportar</button>
                    <button class="btn-stop" onclick="this.closest('.modal-overlay').remove()">❌ Cerrar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
}
