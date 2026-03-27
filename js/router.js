// js/router.js
import { gameState } from './state.js';

const mainContent = document.getElementById('main-content');

export async function loadView(viewName) {
    try {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        mainContent.innerHTML = html;

        // Se apriamo la scheda Squadra, disegniamo le carte
        if (viewName === 'squad') {
            renderSquad();
        }

    } catch (error) {
        console.error("Errore router:", error);
    }
}

function renderSquad() {
    const pitch = document.getElementById('pitch-players');
    const bench = document.getElementById('bench-players');
    if(!pitch || !bench) return;

    pitch.innerHTML = '';
    bench.innerHTML = '';

    // Disegna ogni giocatore
    gameState.userTeam.players.forEach(p => {
        const cardHTML = `
            <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 10px ${p.color}40;">
                <div class="card-overall" style="color: ${p.color};">${p.overall}</div>
                <div class="card-pos">${p.position}</div>
                <div class="card-name">${p.name.split(' ')[1]}</div> </div>
        `;

        if (p.isStarter) {
            pitch.innerHTML += cardHTML;
        } else {
            bench.innerHTML += cardHTML;
        }
    });
}