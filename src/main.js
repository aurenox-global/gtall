/**
 * Arranque de la aplicación y helpers globales.
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

// Global helper functions
function removeAlert(alertId) {
    if (window.alertsSystem) {
        window.alertsSystem.removeAlert(alertId);
    }
}

// Debug function for testing tab switching
function testTabSwitch(tabId) {
    console.log('Testing tab switch to:', tabId);
    if (window.tabManager) {
        window.tabManager.switchTab(tabId);
    } else {
        console.error('TabManager not initialized');
    }
}

// Make tabManager available globally for debugging
window.tabManager = null;

// Initialize the application
let tabManager;
window.addEventListener('load', async () => {
    console.log('Initializing application...');
    
    try {
    await loadTabContents();

        // Setup data persistence first
        DataManager.setupResetButton();
        DataManager.setupDataButtons();
        
        // Request notification permission
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Initialize all systems
        console.log('Initializing trading systems...');
        window.dcaBot = new DCABot();
        window.portfolioManager = new PortfolioManager();
        window.analytics = new Analytics();
        window.alertsSystem = new AlertsSystem();

        // Global functions for manual data modal
        window.openManualDataModal = function() {
            if (window.portfolioManager) {
                window.portfolioManager.openManualDataModal();
            }
        };

        window.closeManualDataModal = function() {
            if (window.portfolioManager) {
                window.portfolioManager.closeManualDataModal();
            }
        };

        window.saveManualData = function() {
            if (window.portfolioManager) {
                window.portfolioManager.saveManualData();
            }
        };

        window.viewAllManualData = function() {
            if (window.portfolioManager) {
                window.portfolioManager.showAllManualData();
            }
        };

        window.deleteManualDataEntry = function(entryId) {
            if (window.portfolioManager) {
                if (window.portfolioManager.deleteManualDataEntry(entryId)) {
                    window.portfolioManager.updateManualDataHistoryDisplay();
                    // Close modal if open
                    const modal = document.querySelector('.modal-overlay');
                    if (modal) {
                        modal.remove();
                    }
                }
            }
        };

        window.exportManualDataHistory = function() {
            if (window.portfolioManager) {
                const history = window.portfolioManager.getManualDataHistory();
                if (history.length === 0) {
                    window.portfolioManager.showMessage('No hay datos para exportar', 'info');
                    return;
                }

                const exportData = {
                    manualDataHistory: history,
                    exportDate: new Date().toISOString(),
                    totalEntries: history.length
                };

                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `manual-data-history-${new Date().getTime()}.json`;
                a.click();
                URL.revokeObjectURL(url);

                window.portfolioManager.showMessage('Historial de datos manuales exportado exitosamente', 'success');
            }
        };

        // Binance API Functions
        window.updateCryptoPrice = async function() {
            const symbol = document.getElementById('cryptoSymbol').value;
            const statusEl = document.getElementById('priceUpdateStatus');
            
            if (!symbol) {
                document.getElementById('currentPrice').value = '';
                document.getElementById('currentPrice').placeholder = 'Selecciona una moneda';
                if (statusEl) statusEl.textContent = '';
                return;
            }

            try {
                document.getElementById('currentPrice').placeholder = 'Cargando...';
                if (statusEl) statusEl.textContent = '⏳ Actualizando precio...';
                
                // Using Binance public API (no API key required)
                const response = await BinanceAPI.fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
                const data = await response.json();
                
                if (data.price) {
                    const price = parseFloat(data.price);
                    document.getElementById('currentPrice').value = price.toFixed(2);
                    
                    if (statusEl) statusEl.textContent = `✅ Precio actualizado: ${new Date().toLocaleTimeString()}`;
                    
                    // Auto-calculate if we have entry price and quantity
                    calculateCryptoValue();
                } else {
                    document.getElementById('currentPrice').placeholder = 'Error al cargar precio';
                    if (statusEl) statusEl.textContent = '❌ Error al cargar precio';
                }
            } catch (error) {
                console.error('Error fetching price:', error);
                document.getElementById('currentPrice').placeholder = 'Error de conexión';
                if (statusEl) statusEl.textContent = '❌ Error de conexión';
            }
        };

        window.calculateCryptoValue = function() {
            const quantity = parseFloat(document.getElementById('cryptoQuantity').value) || 0;
            const entryPrice = parseFloat(document.getElementById('entryPrice').value) || 0;
            const currentPrice = parseFloat(document.getElementById('currentPrice').value) || 0;
            
            if (quantity > 0 && entryPrice > 0) {
                // Calculate total investment
                const totalInvestment = quantity * entryPrice;
                document.getElementById('totalInvestment').value = totalInvestment.toFixed(2);
                
                // Calculate current value
                const currentValue = quantity * currentPrice;
                document.getElementById('currentValue').value = currentValue.toFixed(2);
                
                // Calculate unrealized PnL
                const unrealizedPnl = currentValue - totalInvestment;
                document.getElementById('unrealizedPnl').value = unrealizedPnl.toFixed(2);
                
                // Calculate percentage
                const percentage = totalInvestment > 0 ? (unrealizedPnl / totalInvestment) * 100 : 0;
                const pnlElement = document.getElementById('pnlPercentage');
                
                if (unrealizedPnl > 0) {
                    pnlElement.textContent = `📈 +${percentage.toFixed(2)}% (Ganancia)`;
                    pnlElement.style.color = '#2ecc71';
                } else if (unrealizedPnl < 0) {
                    pnlElement.textContent = `📉 ${percentage.toFixed(2)}% (Pérdida)`;
                    pnlElement.style.color = '#e74c3c';
                } else {
                    pnlElement.textContent = `⚖️ 0.00% (Sin cambios)`;
                    pnlElement.style.color = '#bdc3c7';
                }
                
                // Auto-update portfolio total value
                updatePortfolioSummary();
            }
        };

        window.updatePortfolioSummary = function() {
            const cryptoValue = parseFloat(document.getElementById('currentValue').value) || 0;
            const manualValue = parseFloat(document.getElementById('manualTotalValue').value) || 0;
            
            // Set portfolio total as sum of crypto + manual
            const totalPortfolio = cryptoValue + manualValue;
            document.getElementById('manualTotalValue').value = totalPortfolio.toFixed(2);
            
            // Auto-calculate daily PnL if we have crypto data
            const entryPrice = parseFloat(document.getElementById('entryPrice').value) || 0;
            const currentPrice = parseFloat(document.getElementById('currentPrice').value) || 0;
            const quantity = parseFloat(document.getElementById('cryptoQuantity').value) || 0;
            
            if (entryPrice > 0 && currentPrice > 0 && quantity > 0) {
                const dailyPnl = (currentPrice - entryPrice) * quantity;
                document.getElementById('manualDailyPnl').value = dailyPnl.toFixed(2);
            }
        };

        window.updateAllCryptoPrices = async function() {
            if (!window.portfolioManager) return;
            
            console.log('Updating crypto prices and syncing charts...');
            
            // Update all crypto prices and portfolio values
            await window.portfolioManager.calculateRealTimePortfolioValues();
            
            // Update all displays (this will also refresh the current chart)
            window.portfolioManager.updateMetrics();
            
            window.portfolioManager.showMessage('Portfolio y gráficas actualizadas con precios reales de Binance', 'success');
        };
        
        // Initialize TabManager
        console.log('Initializing TabManager...');
        tabManager = new TabManager();
        window.tabManager = tabManager;
        
        // Eliminar inicialización forzada del Spot al cargar para respetar la pestaña activa
        
        console.log('Application initialization completed successfully');
    } catch (error) {
        console.error('Error during application initialization:', error);
    }
});
