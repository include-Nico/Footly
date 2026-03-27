// js/router.js
import { gameState } from './state.js';

const mainContent = document.getElementById('main-content');

export async function loadView(viewName) {
    try {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        mainContent.innerHTML = html;

        // Se l'utente clicca sulla scheda "Squadra", lanciamo la funzione per disegnare le carte
        if (viewName === 'squad') {
            renderSquad();
        }

    } catch (error) {
        console.error("Errore router:", error);
        mainContent.innerHTML = `<div class="empty-view"><i class="fas fa-triangle-exclamation text-error"></i><h3>Errore</h3><p>Impossibile caricare la vista.</p></div>`;
    }
}

// Funzione che disegna dinamicamente le carte giocatore sul campo e in panchina
function renderSquad() {
    const pitch = document.getElementById('pitch-players');
    const bench = document.getElementById('bench-players');
    
    if(!pitch || !bench) return;

    // Svuotiamo il campo prima di disegnare
    pitch.innerHTML = '';
    bench.innerHTML = '';

    // Controlliamo se ci sono giocatori salvati
    if (!gameState.userTeam.players || gameState.userTeam.players.length === 0) {
        pitch.innerHTML = `<div style="color: var(--text-hint); text-align: center; width: 100%;">Nessun giocatore in rosa. Vai al mercato!</div>`;
        return;
    }

    // Disegniamo ogni giocatore in base al suo stato (Titolare o Riserva)
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