// js/state.js
import { getEffectiveOverall } from './players.js'; 

export const gameState = {
    userTeam: {
        name: "",
        league: "",
        division: 3,
        coins: 10000,
        colors: { primary: "#00f5a0", secondary: "#ffffff" },
        kitStyle: "solid",
        formation: "2-3-1",
        matchday: 1,
        players: [],
        stats: { points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }
    },
    world: {},
    currentView: "home"
};

export function saveGame() {
    localStorage.setItem('footly_save_data', JSON.stringify(gameState));
}

export function loadGame() {
    const savedData = localStorage.getItem('footly_save_data');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        Object.assign(gameState.userTeam, parsedData.userTeam);
        if (parsedData.world) gameState.world = parsedData.world;
        gameState.currentView = parsedData.currentView || "home";

        if (!gameState.userTeam.division) gameState.userTeam.division = 3;
        if (!gameState.userTeam.formation) gameState.userTeam.formation = "2-3-1";
        if (!gameState.userTeam.matchday) gameState.userTeam.matchday = 1;
        
        // FIX Salvataggi: Inizializza i nuovi dati
        if (gameState.userTeam.players) {
            gameState.userTeam.players.forEach(p => { 
                if (p.energy === undefined) p.energy = 100; 
                if (p.stats.yellowCards === undefined) p.stats.yellowCards = 0;
                if (p.stats.redCards === undefined) p.stats.redCards = 0;
                if (p.status.yellowCards !== undefined) delete p.status.yellowCards; // Rimuove vecchia logica
            });
        }
        
        saveGame();
        return true;
    }
    return false;
}

export function resetGame() {
    localStorage.removeItem('footly_save_data');
    location.reload(); 
}

export function getUserTeamStrength() {
    if(!gameState.userTeam.players || gameState.userTeam.players.length === 0) return 0;
    let starters = gameState.userTeam.players.filter(p => p.isStarter);
    if(starters.length === 0) return 0;
    
    let sum = starters.reduce((acc, p) => acc + getEffectiveOverall(p), 0);
    return Math.floor(sum / starters.length);
}