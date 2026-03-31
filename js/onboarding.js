// js/onboarding.js
import { gameState, saveGame, generateCupBracket, generateChampionsBracket } from './state.js';
import { elements, switchToMainApp, updateDashboardHeader, showNotification } from './ui.js';
import { generateInitialSquad } from './players.js';
import { initializeWorld } from './teams.js'; 

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
        
        // Genera Rosa Utente
        gameState.userTeam.players = generateInitialSquad();
        
        // Genera TUTTO il Mondo (Div 1, 2 e 3)
        gameState.world = initializeWorld(gameState.userTeam.league);
        
        // FIX BUG ANNO 1: Genera subito i tabelloni di Coppa e Champions
        generateCupBracket();
        generateChampionsBracket();
        
        saveGame();
        showPackOpening();
    });
}

function validateForm() {
    const valid = gameState.userTeam.name.length > 2 && gameState.userTeam.league !== '';
    startGameBtn.disabled = !valid;
    startGameBtn.classList.toggle('disabled', !valid);
}

function showPackOpening() {
    elements.onboardingScreen.classList.remove('active');
    elements.onboardingScreen.classList.add('hidden');

    const overlay = document.getElementById('pack-overlay');
    const unopened = document.getElementById('pack-unopened');
    const opened = document.getElementById('pack-opened');
    const cardsContainer = document.getElementById('pack-cards-container');
    const finishBtn = document.getElementById('finish-pack-btn');

    overlay.style.display = 'flex';
    
    unopened.onclick = () => {
        unopened.style.display = 'none';
        opened.style.display = 'flex';
        cardsContainer.innerHTML = '';
        
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

    finishBtn.onclick = () => {
        overlay.style.display = 'none';
        updateDashboardHeader();
        switchToMainApp();
        showNotification(`Benvenuto, ${gameState.userTeam.name}!`, `Inizia la scalata in Divisione ${gameState.userTeam.division}.`, 'success', 6000);
    };
}