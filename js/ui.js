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
    elements.displayLeague.textContent   = `${gameState.userTeam.league} · Div ${gameState.userTeam.division}`;
    elements.coinsDisplay.textContent    = gameState.userTeam.coins.toLocaleString('it-IT');
}

// ─── NOTIFICHE FLOTTANTI ───
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

// ─── FINESTRE DI CONFERMA PERSONALIZZATE ───
export function showConfirm(title, message, onConfirm, confirmText = "Conferma", isDanger = false) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const btnColor = isDanger ? 'var(--notif-error)' : 'var(--accent)';
    const btnBg = isDanger ? 'rgba(240, 82, 82, 0.1)' : 'var(--accent-dim)';

    overlay.innerHTML = `
        <div class="modal-box" style="border-top: 4px solid ${btnColor};">
            <h2 style="margin-bottom: 12px; color: ${btnColor};">${title}</h2>
            <p style="font-size: 14px; color: var(--text-hint); margin-bottom: 24px; line-height: 1.5;">${message}</p>
            <div class="modal-buttons">
                <button class="glass-btn cancel-btn" style="flex: 1;">Annulla</button>
                <button class="glass-btn confirm-btn" style="flex: 1; background: ${btnBg}; color: ${btnColor}; border-color: ${btnColor};">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Attiva l'animazione
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

// ─── FINESTRA INFO GIOCATORE ───
export function showPlayerInfo(p) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    let val = p.value || p.overall * 100;
    
    overlay.innerHTML = `
        <div class="modal-box" style="border: 2px solid ${p.color}; box-shadow: 0 10px 40px ${p.color}40;">
            <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                <div>
                    <h2 style="color: ${p.color}; margin-bottom:4px; font-size: 24px;">${p.name}</h2>
                    <div style="font-size: 13px; color: var(--text-primary); font-weight: bold;">
                        ${p.nationality} · ${p.age} anni
                    </div>
                    <div style="font-size: 12px; color: var(--text-hint); margin-top: 4px;">
                        Ruolo: ${p.position} ${p.secondaryPositions.length > 0 ? `(${p.secondaryPositions.join(', ')})` : ''}
                    </div>
                </div>
                <div class="card-overall" style="color: ${p.color}; font-size: 38px; text-shadow: 0 0 15px ${p.color}80;">${p.overall}</div>
            </div>
            
            <div class="divider" style="margin: 16px 0; background: ${p.color}40;"></div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                    <div style="color:var(--text-hint); font-size: 10px; text-transform: uppercase;">Qualità</div>
                    <div style="color:${p.color}; font-weight:bold; font-size: 14px;">${p.rarity}</div>
                </div>
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                    <div style="color:var(--text-hint); font-size: 10px; text-transform: uppercase;">Valore Mercato</div>
                    <div style="color:var(--gold); font-weight:bold; font-size: 14px;">💰 ${val.toLocaleString()}</div>
                </div>
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                    <div style="color:var(--text-hint); font-size: 10px; text-transform: uppercase;">Presenze</div>
                    <div style="color:var(--text-primary); font-weight:bold; font-size: 14px;">${p.stats.appearances}</div>
                </div>
                <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                    <div style="color:var(--text-hint); font-size: 10px; text-transform: uppercase;">Gol / Assist</div>
                    <div style="color:var(--text-primary); font-weight:bold; font-size: 14px;">${p.stats.goals} / ${p.stats.assists}</div>
                </div>
            </div>
            
            <button class="glass-btn close-btn" style="width: 100%; margin-top: 24px; border-color: ${p.color}; color: ${p.color};">Chiudi Scheda</button>
        </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    
    overlay.querySelector('.close-btn').onclick = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };
}