import { gameState } from './state.js';
import { elements, switchToMainApp, updateDashboardHeader } from './ui.js';

// Riferimenti DOM per la schermata iniziale
const teamNameInput = document.getElementById('team-name');
const leagueBtns = document.querySelectorAll('.league-btn');
const startGameBtn = document.getElementById('start-game-btn');

// ECCO LA FUNZIONE CHE MAIN.JS STA CERCANDO:
export function initOnboarding() {
    
    // Selezione del Campionato
    leagueBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Rimuove la selezione precedente
            leagueBtns.forEach(b => b.classList.remove('active-league'));
            // Evidenzia la nuova selezione
            btn.classList.add('active-league');
            gameState.userTeam.league = btn.getAttribute('data-league');
            
            validateForm();
        });
    });

    // Controllo Input Nome Squadra
    teamNameInput.addEventListener('input', (e) => {
        gameState.userTeam.name = e.target.value.trim();
        validateForm();
    });

    // Avvio del Gioco (Click sul bottone)
    startGameBtn.addEventListener('click', () => {
        updateDashboardHeader();
        switchToMainApp();
        console.log("Gioco avviato! Stato attuale:", gameState);
    });
}

// Funzione interna per sbloccare il bottone "Inizia"
function validateForm() {
    // Il nome deve avere più di 2 caratteri e il campionato deve essere scelto
    if (gameState.userTeam.name.length > 2 && gameState.userTeam.league !== "") {
        startGameBtn.disabled = false;
        startGameBtn.classList.remove('disabled');
    } else {
        startGameBtn.disabled = true;
        startGameBtn.classList.add('disabled');
    }
}