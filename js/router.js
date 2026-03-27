// js/router.js
import { gameState, resetGame } from './state.js';

const mainContent = document.getElementById('main-content');

export async function loadView(viewName) {
    try {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        mainContent.innerHTML = html;

        // Gestiamo le logiche in base alla schermata aperta
        if (viewName === 'squad') {
            renderSquad();
        } else if (viewName === 'profile') {
            renderProfile(); // Lancia la logica del profilo!
        }

    } catch (error) {
        console.error("Errore router:", error);
        mainContent.innerHTML = `<div class="empty-view"><i class="fas fa-triangle-exclamation text-error"></i><h3>Errore</h3><p>Impossibile caricare la vista.</p></div>`;
    }
}

// Disegna le carte giocatore (Campo e Panchina)
function renderSquad() {
    const pitch = document.getElementById('pitch-players');
    const bench = document.getElementById('bench-players');
    
    if(!pitch || !bench) return;

    pitch.innerHTML = '';
    bench.innerHTML = '';

    if (!gameState.userTeam.players || gameState.userTeam.players.length === 0) {
        pitch.innerHTML = `<div style="color: var(--text-hint); text-align: center; width: 100%;">Nessun giocatore in rosa. Vai al mercato!</div>`;
        return;
    }

    gameState.userTeam.players.forEach(p => {
        const cardHTML = `
            <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                <div class="card-pos">${p.position}</div>
                <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
            </div>
        `;

        if (p.isStarter) {
            pitch.innerHTML += cardHTML;
        } else {
            bench.innerHTML += cardHTML;
        }
    });
}

// Inizializza la schermata Profilo
function renderProfile() {
    const teamNameEl = document.getElementById('profile-team-name');
    const leagueDivEl = document.getElementById('profile-league-div');
    const coinsEl = document.getElementById('profile-coins');
    const playersCountEl = document.getElementById('profile-players-count');
    const deleteBtn = document.getElementById('delete-account-btn');

    // Scrive i dati della squadra a schermo
    if (teamNameEl) teamNameEl.textContent = gameState.userTeam.name;
    if (leagueDivEl) leagueDivEl.textContent = `${gameState.userTeam.league} · Div ${gameState.userTeam.division}`;
    if (coinsEl) coinsEl.textContent = gameState.userTeam.coins.toLocaleString('it-IT');
    if (playersCountEl && gameState.userTeam.players) {
        playersCountEl.textContent = gameState.userTeam.players.length;
    }

    // Attiva il bottone per cancellare l'account
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            // Chiede conferma prima di distruggere tutto!
            const confirmDelete = confirm("⚠️ ATTENZIONE: Sei sicuro di voler cancellare la tua squadra? L'azione è irreversibile.");
            if (confirmDelete) {
                resetGame();
            }
        });
    }
}