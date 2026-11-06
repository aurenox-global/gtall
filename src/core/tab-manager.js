/**
 * Carga perezosa de pestañas (pages/*.html) y gestión de tabs.
 * Extraído de assets/js/app.js (monolito original) — refactor modular.
 * Script clásico: comparte el ámbito global con el resto de módulos.
 */

async function loadTabContents() {
    const tabContents = Array.from(document.querySelectorAll('.tab-content[data-src]'));
    if (tabContents.length === 0) return;

    await Promise.all(tabContents.map(async (tab) => {
        if (tab.dataset.loaded === 'true') return;
        const src = tab.dataset.src;
        if (!src) return;

        try {
            const response = await fetch(src, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const html = await response.text();
            tab.innerHTML = html;
            tab.dataset.loaded = 'true';
        } catch (error) {
            tab.innerHTML = `<div class="error">No se pudo cargar ${src}. ${error.message}</div>`;
            tab.dataset.loaded = 'error';
        }
    }));
}

class TabManager {
    constructor() {
        // Cargar pestaña activa desde localStorage o usar 'spot-grid' como default
        this.activeTab = localStorage.getItem('activeTab') || 'spot-grid';
        this.enforceInterval = null;
        this.init();
    }

    init() {
        this.setupTabEventListeners();
        // Aplicar la pestaña cargada desde localStorage
        this.switchTab(this.activeTab);
        if (!this.enforceInterval) {
            this.enforceInterval = setInterval(() => this.ensureActiveTabState(), 1000);
        }
    }

    setupTabEventListeners() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        console.log('Setting up tab listeners for', tabButtons.length, 'buttons');
        
        tabButtons.forEach(btn => {
            if (btn.dataset.tab) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Tab clicked:', btn.dataset.tab);
                    this.switchTab(btn.dataset.tab);
                });
                console.log('Listener added for tab:', btn.dataset.tab);
            } else {
                console.warn('Tab button missing data-tab attribute:', btn);
            }
        });
    }

    ensureActiveTabState() {
        try {
            const currentActiveContent = document.querySelector('.tab-content.active');
            const currentActiveButton = document.querySelector('.tab-btn.active');
            const shouldBeContent = document.getElementById(this.activeTab);
            const shouldBeButton = document.querySelector(`[data-tab="${this.activeTab}"]`);
            if (!shouldBeContent || !shouldBeButton) return;

            if (currentActiveContent !== shouldBeContent) {
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                shouldBeContent.classList.add('active');
            }
            if (currentActiveButton !== shouldBeButton) {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                shouldBeButton.classList.add('active');
            }
        } catch (e) {}
    }

    switchTab(tabId) {
        if (!tabId) {
            console.error('No tabId provided to switchTab');
            return;
        }
        
        console.log('Switching to tab:', tabId);
        
        try {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Remove active class from all tab buttons
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Show selected tab content
            const targetTab = document.getElementById(tabId);
            if (targetTab) {
                targetTab.classList.add('active');
                console.log('Tab content shown:', tabId);
            } else {
                console.error('Tab content not found:', tabId);
                return;
            }

            // Add active class to selected tab button
            const targetButton = document.querySelector(`[data-tab="${tabId}"]`);
            if (targetButton) {
                targetButton.classList.add('active');
                console.log('Tab button activated:', tabId);
            } else {
                console.error('Tab button not found:', tabId);
            }

            this.activeTab = tabId;
            
            // Guardar pestaña activa en localStorage
            localStorage.setItem('activeTab', tabId);

            // Initialize respective modules when tab is activated
            this.initializeTabModule(tabId);
            
            console.log('Tab switch completed successfully');
        } catch (error) {
            console.error('Error switching tabs:', error);
        }
    }

    initializeTabModule(tabId) {
        switch(tabId) {
            case 'spot-grid':
                if (!window.spotGridBot) {
                    window.spotGridBot = new SpotGridTradingBot();
                }
                break;
            case 'futures-grid':
                if (!window.futuresGridBot) {
                    window.futuresGridBot = new FuturesGridTradingBot();
                }
                break;
            case 'manual-spot':
                if (!window.manualSpotTrader) {
                    window.manualSpotTrader = new ManualSpotTrader();
                }
                break;
            case 'manual-futures':
                if (!window.manualFuturesTrader) {
                    window.manualFuturesTrader = new ManualFuturesTrader();
                }
                break;
            case 'dca-bot':
                if (!window.dcaBot) {
                    window.dcaBot = new DCABot();
                }
                break;
            case 'portfolio':
                if (!window.portfolioManager) {
                    window.portfolioManager = new PortfolioManager();
                }
                break;
            case 'analytics':
                if (!window.analytics) {
                    window.analytics = new Analytics();
                }
                break;
            case 'alerts':
                if (!window.alertsSystem) {
                    window.alertsSystem = new AlertsSystem();
                }
                break;
        }
    }
}
