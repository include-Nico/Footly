// js/ui.js
import { gameState } from './state.js';
import { loadView } from './router.js';

export const elements = {
    onboardingScreen:  document.getElementById('onboarding-screen'),
    mainAppScreen:     document.getElementById('main-app-screen'),
    displayTeamName:   document.getElementById('display-team-name'),
    displayLeague:     document.getElementById('display-league'),
    coinsDisplay:      document.getElementById('coins-display'),
    navItems:          document.querySelectorAll('.nav-item'),
    notifContainer:    document.getElementById('notification-container'),
};

export function switchToMainApp() {
    elements.onboardingScreen.classList.remove('active');
    elements.onboardingScreen.classList.add('hidden');
    elements.mainAppScreen.classList.remove('hidden');
    elements.mainAppScreen.classList.add('active');
    loadView('home');
}

export function updateDashboardHeader() {
    elements.displayTeamName.textContent = gameState.userTeam.name;
    // Mostriamo Campionato e Divisione!
    elements.displayLeague.textContent   = `${gameState.userTeam.league} · Div ${gameState.userTeam.division}`;
    elements.coinsDisplay.textContent    = gameState.userTeam.coins.toLocaleString('it-IT');
}

const ICONS = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };

export function showNotification(title, message = '', type = 'info', duration = 4000) {
    const card = document.createElement('div');
    card.className = `notif-card ${type}`;
    card.setAttribute('role', 'alert');
    card.innerHTML = `
        <div class="notif-inner">
            <div class="notif-icon"><i class="fas ${ICONS[type] ?? ICONS.info}"></i></div>
            <div class="notif-body">
                <div class="notif-title">${title}</div>
                ${message ? `<div class="notif-msg">${message}</div>` : ''}
            </div>
            <button class="notif-close" aria-label="Chiudi"><i class="fas fa-xmark"></i></button>
        </div>
        ${duration > 0 ? `<div class="notif-progress"><div class="notif-progress-bar" style="animation-duration:${duration}ms"></div></div>` : ''}
    `;
    elements.notifContainer.prepend(card);
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
    const dismiss = () => {
        card.classList.remove('show');
        card.classList.add('hide');
        card.addEventListener('transitionend', () => card.remove(), { once: true });
    };
    card.querySelector('.notif-close').addEventListener('click', dismiss);
    if (duration > 0) setTimeout(dismiss, duration);
}