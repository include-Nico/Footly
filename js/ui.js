// js/ui.js
import { gameState } from './state.js';
import { loadView } from './router.js';

export const elements = {
    onboardingScreen:  document.getElementById('onboarding-screen'),
    mainAppScreen:     document.getElementById('main-app-screen'),
    displayTeamName:   document.getElementById('display-team-name'),
    displayLeague:     document.getElementById('display-league'),
    coinsDisplay:      document.getElementById('coins-display'),
    gemsDisplay:       document.getElementById('gems-display'),
    navItems:          document.querySelectorAll('.nav-item'),
    notifContainer:    document.getElementById('notification-container'),
};

// FIX: SINCRONIZZA LA BARRA DI NAVIGAZIONE AUTOMATICAMENTE
export function updateNavUI(viewName) {
    elements.navItems.forEach(btn => {
        if (btn.getAttribute('data-target') === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

export function switchToMainApp() {
    elements.onboardingScreen.classList.remove('active');
    elements.onboardingScreen.classList.add('hidden');
    elements.mainAppScreen.classList.remove('hidden');
    elements.mainAppScreen.classList.add('active');
    loadView('home');
}

export function updateDashboardHeader() {
    elements.displayTeamName.textContent = gameState.userTeam.name;
    elements.displayLeague.textContent   = `${gameState.userTeam.league} · Div ${gameState.userTeam.division}`;
    elements.coinsDisplay.textContent    = gameState.userTeam.coins.toLocaleString('it-IT');
    if(elements.gemsDisplay) elements.gemsDisplay.textContent = gameState.userTeam.gems.toLocaleString('it-IT');
}

const ICONS = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };

export function showNotification(title, message = '', type = 'info', duration = 4000) {
    const card = document.createElement('div');
    card.className = `notif-card ${type}`;
    card.innerHTML = `
        <div class="notif-inner">
            <div class="notif-icon"><i class="fas ${ICONS[type] ?? ICONS.info}"></i></div>
            <div class="notif-body">
                <div class="notif-title">${title}</div>
                ${message ? `<div class="notif-msg">${message}</div>` : ''}
            </div>
            <button class="notif-close"><i class="fas fa-xmark"></i></button>
        </div>
        ${duration > 0 ? `<div class="notif-progress"><div class="notif-progress-bar" style="animation-duration:${duration}ms"></div></div>` : ''}
    `;
    elements.notifContainer.prepend(card);
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
    
    const dismiss = () => {
        card.classList.remove('show'); card.classList.add('hide');
        card.addEventListener('transitionend', () => card.remove(), { once: true });
    };
    card.querySelector('.notif-close').addEventListener('click', dismiss);
    if (duration > 0) setTimeout(dismiss, duration);
}

export function showConfirm(title, message, onConfirm, confirmText = "Conferma", isDanger = false, hideCancel = false) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const btnColor = isDanger ? 'var(--notif-error)' : 'var(--accent)';
    const btnBg = isDanger ? 'rgba(240, 82, 82, 0.1)' : 'var(--accent-dim)';

    overlay.innerHTML = `
        <div class="modal-box" style="border-top: 4px solid ${btnColor};">
            <h2 style="margin-bottom: 12px; color: ${btnColor};">${title}</h2>
            <p style="font-size: 14px; color: var(--text-hint); margin-bottom: 24px; line-height: 1.5;">${message}</p>
            <div class="modal-buttons">
                <button class="glass-btn cancel-btn" style="flex: 1; display: ${hideCancel ? 'none' : 'block'};">Annulla</button>
                <button class="glass-btn confirm-btn" style="flex: 1; background: ${btnBg}; color: ${btnColor}; border-color: ${btnColor};">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    overlay.querySelector('.cancel-btn').onclick = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };
    overlay.querySelector('.confirm-btn').onclick = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        onConfirm();
    };
}