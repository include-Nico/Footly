// js/onboarding.js
import { gameState, saveGame } from './state.js';
import { elements, switchToMainApp, updateDashboardHeader, showNotification } from './ui.js';
import { generateInitialSquad } from './players.js';

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
        
        // Genera giocatori e Salva
        gameState.userTeam.players = generateInitialSquad();
        saveGame();

        // Lancia l'animazione di apertura pacchetto!
        showPackOpening();
    });
}

function validateForm() {
    const valid = gameState.userTeam.name.length > 2 && gameState.userTeam.league !== '';
    startGameBtn.disabled = !valid;
    startGameBtn.classList.toggle('disabled', !valid);
}

// LOGICA APERTURA PACCHETTO
function showPackOpening() {
    // Nascondiamo l'onboarding
    elements.onboardingScreen.classList.remove('active');
    elements.onboardingScreen.classList.add('hidden');

    const overlay = document.getElementById('pack-overlay');
    const unopened = document.getElementById('pack-unopened');
    const opened = document.getElementById('pack-opened');
    const cardsContainer = document.getElementById('pack-cards-container');
    const finishBtn = document.getElementById('finish-pack-btn');

    overlay.style.display = 'flex';
    
    // Clicca per svelare
    unopened.onclick = () => {
        unopened.style.display = 'none';
        opened.style.display = 'flex';
        
        cardsContainer.innerHTML = '';
        
        // Disegna le carte una per una in stile cascata
        gameState.userTeam.players.forEach((p, index) => {
            setTimeout(() => {
                cardsContainer.innerHTML += `
                    <div class="player-card pop-in" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                        <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                        <div class="card-pos">${p.position}</div>
                        <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
                    </div>
                `;
            }, index * 150);
        });
    };

    // Fine apertura, andiamo al gioco!
    finishBtn.onclick = () => {
        overlay.style.display = 'none';
        updateDashboardHeader();
        switchToMainApp();
        showNotification(
            `Benvenuto, ${gameState.userTeam.name}!`,
            `Inizia la tua scalata partendo dalla Divisione ${gameState.userTeam.division}!`,
            'success',
            6000
        );
    };
}