import { initOnboarding } from './onboarding.js';
import { elements } from './ui.js';
import { gameState } from './state.js';
import { loadView } from './router.js';

// Inizializza l'Onboarding
initOnboarding();

// Logica di Routing per la Navigazione Inferiore
elements.navItems.forEach(nav => {
    nav.addEventListener('click', () => {
        
        // Evita di ricaricare se stiamo già su quella pagina
        const targetView = nav.getAttribute('data-target');
        if (gameState.currentView === targetView) return;

        // Gestione visiva del menu attivo
        elements.navItems.forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        
        // Aggiorna lo stato e carica l'HTML corretto
        gameState.currentView = targetView;
        loadView(targetView);
    });
});