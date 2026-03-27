// js/onboarding.js
import { gameState, saveGame } from './state.js';
import { elements, switchToMainApp, updateDashboardHeader, showNotification } from './ui.js';
import { generateInitialSquad } from './players.js'; // Importiamo il generatore!

const teamNameInput    = document.getElementById('team-name');
const leagueBtns       = document.querySelectorAll('.league-btn');
const startGameBtn     = document.getElementById('start-game-btn');
const colorPrimaryInput  = document.getElementById('color-primary');
const colorSecondaryInput = document.getElementById('color-secondary');
const kitStyleSelect   = document.getElementById('kit-style');

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
        gameState.userTeam.colors.primary   = colorPrimaryInput.value;
        gameState.userTeam.colors.secondary = colorSecondaryInput.value;
        gameState.userTeam.kitStyle         = kitStyleSelect.value;
        
        // GENERA I 12 GIOCATORI!
        gameState.userTeam.players = generateInitialSquad();

        saveGame();
        updateDashboardHeader();
        switchToMainApp();

        showNotification(
            `Benvenuto, ${gameState.userTeam.name}!`,
            `Abbiamo assegnato i primi 12 giocatori alla tua rosa.`,
            'success',
            5000
        );
    });
}

function validateForm() {
    const valid = gameState.userTeam.name.length > 2 && gameState.userTeam.league !== '';
    startGameBtn.disabled = !valid;
    startGameBtn.classList.toggle('disabled', !valid);
}