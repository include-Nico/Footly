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