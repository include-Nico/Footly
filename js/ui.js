import { gameState } from './state.js';
import { loadView } from './router.js'; // Aggiunto import

export const elements = {
    onboardingScreen: document.getElementById('onboarding-screen'),
    mainAppScreen: document.getElementById('main-app-screen'),
    displayTeamName: document.getElementById('display-team-name'),
    displayLeague: document.getElementById('display-league'),
    coinsDisplay: document.getElementById('coins-display'),
    navItems: document.querySelectorAll('.nav-item')
};

export function switchToMainApp() {
    elements.onboardingScreen.classList.remove('active');
    elements.onboardingScreen.classList.add('hidden');
    
    elements.mainAppScreen.classList.remove('hidden');
    elements.mainAppScreen.classList.add('active');
    
    // Carica la prima vista all'ingresso nell'app
    loadView('home');
}

export function updateDashboardHeader() {
    elements.displayTeamName.textContent = gameState.userTeam.name;
    elements.displayLeague.textContent = `Campionato: ${gameState.userTeam.league}`;
    elements.coinsDisplay.textContent = gameState.userTeam.coins.toLocaleString();
}