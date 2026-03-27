// js/main.js
import { initOnboarding } from './onboarding.js';
import { elements, switchToMainApp, updateDashboardHeader } from './ui.js';
import { gameState, loadGame } from './state.js';
import { loadView } from './router.js';

// --- LOGICA DI AVVIO ---
// Controlliamo se l'utente ha già salvato in passato
if (loadGame()) {
    console.log("Dati di salvataggio trovati! Rientro in game...");
    updateDashboardHeader();
    switchToMainApp(); // Salta l'onboarding e va dritto alla Dashboard
} else {
    console.log("Nessun salvataggio trovato. Avvio Creazione Squadra.");
    initOnboarding();  // Mostra l'onboarding
}

// Logica di Routing per la Navigazione Inferiore
elements.navItems.forEach(nav => {
    nav.addEventListener('click', () => {
        const targetView = nav.getAttribute('data-target');
        if (gameState.currentView === targetView) return;

        elements.navItems.forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        
        gameState.currentView = targetView;
        loadView(targetView);
    });
});