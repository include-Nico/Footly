// js/onboarding.js
import { gameState, saveGame } from './state.js';
import { elements, switchToMainApp, updateDashboardHeader } from './ui.js';

const teamNameInput = document.getElementById('team-name');
const leagueBtns = document.querySelectorAll('.league-btn');
const startGameBtn = document.getElementById('start-game-btn');

// Nuovi input
const colorPrimaryInput = document.getElementById('color-primary');
const colorSecondaryInput = document.getElementById('color-secondary');
const kitStyleSelect = document.getElementById('kit-style');

export function initOnboarding() {
    
    leagueBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            leagueBtns.forEach(b => b.classList.remove('active-league'));
            btn.classList.add('active-league');
            gameState.userTeam.league = btn.getAttribute('data-league');
            validateForm();
        });
    });

    teamNameInput.addEventListener('input', (e) => {
        gameState.userTeam.name = e.target.value.trim();
        validateForm();
    });

    startGameBtn.addEventListener('click', () => {
        // 1. Salva colori e divisa scelti
        gameState.userTeam.colors.primary = colorPrimaryInput.value;
        gameState.userTeam.colors.secondary = colorSecondaryInput.value;
        gameState.userTeam.kitStyle = kitStyleSelect.value;

        // 2. SALVA TUTTO NEL BROWSER!
        saveGame();

        // 3. Avvia interfaccia
        updateDashboardHeader();
        switchToMainApp();
    });
}

function validateForm() {
    if (gameState.userTeam.name.length > 2 && gameState.userTeam.league !== "") {
        startGameBtn.disabled = false;
        startGameBtn.classList.remove('disabled');
    } else {
        startGameBtn.disabled = true;
        startGameBtn.classList.add('disabled');
    }
}