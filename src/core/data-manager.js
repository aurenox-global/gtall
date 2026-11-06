/**
 * DataManager — persistencia en localStorage + reset global.
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

class DataManager {
    static get keys() {
        return (typeof StorageSchema !== 'undefined' && StorageSchema.STORAGE_KEYS) || [
            'manualSpotData',
            'manualFuturesData',
            'spotGridData',
            'futuresGridData',
            'dcaBotData',
            'alertsData',
            'portfolioData',
            'analyticsData'
        ];
    }

    static saveData(key, data) {
        try {
            const payload = typeof StorageSchema !== 'undefined'
                ? StorageSchema.stampRecord(data)
                : data;
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    static loadData(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return defaultValue;
            const parsed = JSON.parse(data);
            return typeof StorageSchema !== 'undefined'
                ? StorageSchema.unwrapRecord(parsed, defaultValue)
                : parsed;
        } catch (error) {
            console.error('Error loading data:', error);
            return defaultValue;
        }
    }

    /** Descarga un backup JSON de todos los datos locales. */
    static exportAll() {
        if (typeof StorageSchema === 'undefined') {
            alert('El módulo de almacenamiento no está cargado.');
            return null;
        }
        const payload = StorageSchema.packExport(key => localStorage.getItem(key));
        const filename = StorageSchema.downloadJson(payload);
        console.log('Backup exportado:', filename, payload.keys);
        return filename;
    }

    /** Importa un backup JSON validado y recarga la página. */
    static async importFromFile(file) {
        if (!file) return false;
        if (typeof StorageSchema === 'undefined') {
            alert('El módulo de almacenamiento no está cargado.');
            return false;
        }

        let result;
        try {
            result = StorageSchema.parseImport(await file.text());
        } catch (error) {
            alert('❌ No se pudo leer el archivo: ' + error.message);
            return false;
        }

        if (!result.ok) {
            alert('❌ Importación cancelada:\n\n• ' + result.errors.join('\n• '));
            return false;
        }

        const { data, warnings, migratedFrom } = StorageSchema.migrateImport(result.payload);
        const keys = Object.keys(data);
        const detail = [
            `Backup del ${result.payload.exportedAt || 'fecha desconocida'} (v${migratedFrom})`,
            `${keys.length} conjuntos de datos: ${keys.join(', ')}`,
        ];
        if (warnings.length) detail.push('', 'Avisos:', ...warnings.map(w => `• ${w}`));
        detail.push('', 'Se sobrescribirán los datos actuales. ¿Continuar?');

        if (!confirm('⬆️ IMPORTAR BACKUP\n\n' + detail.join('\n'))) return false;

        try {
            for (const [key, value] of Object.entries(data)) {
                localStorage.setItem(key, JSON.stringify(StorageSchema.stampRecord(value)));
            }
            alert(`✅ Importados ${keys.length} conjuntos de datos. La página se recargará.`);
            location.reload();
            return true;
        } catch (error) {
            alert('❌ Error al guardar los datos importados: ' + error.message);
            return false;
        }
    }

    static setupDataButtons() {
        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => DataManager.exportAll());
        }

        const importBtn = document.getElementById('importData');
        const importInput = document.getElementById('importDataFile');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', async () => {
                const file = importInput.files && importInput.files[0];
                await DataManager.importFromFile(file);
                importInput.value = '';
            });
        }
    }

    static clearAllData() {
        try {
            // Lista completa de todas las claves de datos
            const keys = DataManager.keys;
            
            keys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            console.log('All trading data cleared from localStorage');
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }

    static resetAllInstances() {
        try {
            // Detener todos los intervalos y limpiar estados
            if (window.manualSpotTrader) {
                window.manualSpotTrader.usdtBalance = 0;
                window.manualSpotTrader.cryptoBalance = 0;
                window.manualSpotTrader.totalValue = 0;
                window.manualSpotTrader.totalPnl = 0;
                window.manualSpotTrader.totalTrades = 0;
                window.manualSpotTrader.capitalNet = 0;
                window.manualSpotTrader.activePositions = [];
                window.manualSpotTrader.tradeHistory = [];
                window.manualSpotTrader.updateDisplay();
            }
            
            if (window.manualFuturesTrader) {
                window.manualFuturesTrader.availableMargin = 0;
                window.manualFuturesTrader.usedMargin = 0;
                window.manualFuturesTrader.unrealizedPnl = 0;
                window.manualFuturesTrader.realizedPnl = 0;
                window.manualFuturesTrader.fundingFees = 0;
                window.manualFuturesTrader.totalTrades = 0;
                window.manualFuturesTrader.capitalNet = 0;
                window.manualFuturesTrader.activePositions = [];
                window.manualFuturesTrader.tradeHistory = [];
                window.manualFuturesTrader.updateDisplay();
            }
            
            if (window.dcaBot) {
                if (window.dcaBot.dcaInterval) {
                    clearInterval(window.dcaBot.dcaInterval);
                }
                window.dcaBot.isRunning = false;
                window.dcaBot.totalInvested = 0;
                window.dcaBot.totalQuantity = 0;
                window.dcaBot.averagePrice = 0;
                window.dcaBot.executions = [];
                window.dcaBot.nextExecution = null;
                window.dcaBot.updateDisplay();
            }
            
            if (window.alertsSystem) {
                window.alertsSystem.alerts = [];
                window.alertsSystem.activeCount = 0;
                window.alertsSystem.triggeredToday = 0;
                window.alertsSystem.totalCount = 0;
                window.alertsSystem.updateDisplay();
            }
            
            if (window.spotGridBot) {
                window.spotGridBot.stopBot();
            }
            
            if (window.futuresGridBot) {
                window.futuresGridBot.stopBot();
            }
            
            console.log('All instances reset successfully');
        } catch (error) {
            console.error('Error resetting instances:', error);
        }
    }

    static setupResetButton() {
        const resetButton = document.getElementById('resetAllData');
        if (!resetButton) {
            console.error('Reset button not found');
            return;
        }
        
        resetButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            const confirmation = confirm(
                '⚠️ ¿Estás seguro de que quieres RESETEAR TODOS LOS DATOS?\n\n' +
                'Esto borrará:\n' +
                '• Todos los balances\n' +
                '• Todas las posiciones activas\n' +
                '• Todo el historial de trades\n' +
                '• Configuraciones guardadas\n' +
                '• Datos del DCA Bot\n' +
                '• Alertas creadas\n\n' +
                'Esta acción NO se puede deshacer.'
            );
            
            if (confirmation) {
                // Ofrecer un backup antes de borrar: el reset es irreversible.
                const wantsBackup = confirm(
                    '💾 ¿Quieres descargar un backup antes de borrar?\n\n' +
                    'Aceptar = descargar backup y continuar\nCancelar = borrar sin backup'
                );
                if (wantsBackup) {
                    try {
                        DataManager.exportAll();
                    } catch (error) {
                        console.error('No se pudo exportar el backup:', error);
                    }
                }

                try {
                    // Mostrar mensaje de procesamiento
                    resetButton.disabled = true;
                    resetButton.textContent = '🔄 Borrando datos...';
                    
                    // Limpiar datos
                    const success = DataManager.clearAllData();
                    
                    if (success) {
                        resetButton.textContent = '✅ Datos borrados';
                        
                        // Resetear todas las instancias sin recargar la página
                        DataManager.resetAllInstances();
                        
                        // Mostrar mensaje de éxito
                        setTimeout(() => {
                            resetButton.disabled = false;
                            resetButton.textContent = '🗑️ RESETEAR TODOS LOS DATOS';
                            alert('✅ Todos los datos han sido borrados exitosamente');
                        }, 1000);
                    } else {
                        throw new Error('Failed to clear data');
                    }
                } catch (error) {
                    console.error('Error during reset:', error);
                    resetButton.disabled = false;
                    resetButton.textContent = '🗑️ RESETEAR TODOS LOS DATOS';
                    alert('❌ Error al borrar los datos. Por favor recarga la página manualmente.');
                }
            }
        });
    }
}
