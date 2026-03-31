// js/main.js
import { initOnboarding } from './onboarding.js';
import { elements, switchToMainApp, updateDashboardHeader, showNotification } from './ui.js';
import { gameState, loadGame } from './state.js';
import { loadView } from './router.js';

if (loadGame()) {
    updateDashboardHeader();
    switchToMainApp();

    showNotification(
        `Bentornato, ${gameState.userTeam.name}!`,
        `Campionato di ${gameState.userTeam.league} · Div ${gameState.userTeam.division}`,
        'success',
        4500
    );
} else {
    initOnboarding();
}

// Navigazione tramite CLICK sulla Bottom Nav
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

// ==========================================
// NUOVA LOGICA: SWIPE NAVIGATION
// ==========================================
const mainContent = document.getElementById('main-content');
let touchStartX = 0;
let touchStartY = 0;

mainContent.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: true});

mainContent.addEventListener('touchend', e => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    
    // PROTEZIONE: Evita di cambiare pagina se stiamo interagendo con elementi speciali
    if (e.target.closest('#schedule-container') ||          // Calendario a scorrimento orizzontale
        e.target.closest('.player-card-interactive') ||     // Sostituzione giocatori (drag & drop)
        e.target.closest('.goal-grid') ||                   // Griglia dei rigori / occasioni
        e.target.closest('.table-responsive') ||            // Tabelle scorrimento
        e.target.closest('#pack-reveal-area') ||            // Animazione spacchettamento
        e.target.closest('.hub-list-item')) {               // Hub Squadra giocatori
        return;
    }

    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    
    // Se lo swipe è più verticale che orizzontale, ignoralo (l'utente sta solo scorrendo la pagina in basso/alto)
    if (Math.abs(dy) > Math.abs(dx)) return;
    
    // Soglia minima di scorrimento laterale per attivare il cambio pagina (70 pixel)
    if (Math.abs(dx) < 70) return;

    // Ordine esatto delle schermate nella Navigation Bar
    const viewsOrder = ['home', 'squad', 'market', 'store', 'profile'];
    let currentIndex = viewsOrder.indexOf(gameState.currentView);
    if (currentIndex === -1) return;
    
    let targetView = null;
    
    if (dx < -70 && currentIndex < viewsOrder.length - 1) {
        // Swipe verso SINISTRA (<--) -> Vai alla schermata SUCCESSIVA (Destra)
        targetView = viewsOrder[currentIndex + 1];
    } else if (dx > 70 && currentIndex > 0) {
        // Swipe verso DESTRA (-->) -> Vai alla schermata PRECEDENTE (Sinistra)
        targetView = viewsOrder[currentIndex - 1];
    }
    
    if (targetView) {
        // Aggiorna la grafica della Bottom Nav
        elements.navItems.forEach(n => n.classList.remove('active'));
        const targetNav = Array.from(elements.navItems).find(n => n.getAttribute('data-target') === targetView);
        if (targetNav) targetNav.classList.add('active');
        
        // Cambia la view
        gameState.currentView = targetView;
        loadView(targetView);
    }
}, {passive: true});