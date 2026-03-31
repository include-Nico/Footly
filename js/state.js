// js/state.js
import { getEffectiveOverall } from './players.js'; 

export const gameState = {
    userTeam: {
        name: "",
        league: "",
        division: 3,
        coins: 10000,
        gems: 50,
        inventory: { healAll: 0, healPlayer: 0, superBoosts: 0 },
        activeBoostMatches: 0,
        roles: { captain: null, penalty: null }, // NUOVO: Ruoli
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
        
        if (!parsedData.world || !parsedData.world["Italia"]) {
            console.log("Vecchio salvataggio rilevato. Reset forzato per evitare crash.");
            resetGame();
            return false;
        }

        Object.assign(gameState.userTeam, parsedData.userTeam);
        if (parsedData.world) gameState.world = parsedData.world;
        gameState.currentView = parsedData.currentView || "home";

        if (!gameState.userTeam.division) gameState.userTeam.division = 3;
        if (!gameState.userTeam.formation) gameState.userTeam.formation = "2-3-1";
        if (!gameState.userTeam.matchday) gameState.userTeam.matchday = 1;
        
        if (gameState.userTeam.gems === undefined) gameState.userTeam.gems = 50;
        if (!gameState.userTeam.inventory) gameState.userTeam.inventory = { healAll: 0, healPlayer: 0, superBoosts: 0 };
        if (gameState.userTeam.activeBoostMatches === undefined) gameState.userTeam.activeBoostMatches = 0;
        if (!gameState.userTeam.roles) gameState.userTeam.roles = { captain: null, penalty: null };

        if (gameState.userTeam.players) {
            gameState.userTeam.players.forEach(p => { 
                if (p.energy === undefined) p.energy = 100; 
                if (p.stats.yellowCards === undefined) p.stats.yellowCards = 0;
                if (p.stats.redCards === undefined) p.stats.redCards = 0;
                if (p.status.yellowCards === undefined) p.status.yellowCards = 0; 
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
    
    let sum = starters.reduce((acc, p) => {
        if (p.status && p.status.suspended === 2) return acc; 
        return acc + getEffectiveOverall(p);
    }, 0);
    
    let baseStr = Math.floor(sum / starters.length); 
    
    // BONUS CAPITANO IN CAMPO (+1 Overall)
    if (gameState.userTeam.roles && gameState.userTeam.roles.captain) {
        let capOnPitch = starters.find(p => p.id === gameState.userTeam.roles.captain && p.status.suspended === 0);
        if (capOnPitch) baseStr += 1;
    }

    if (gameState.userTeam.activeBoostMatches > 0) {
        baseStr = Math.floor(baseStr * 1.15);
    }
    
    return baseStr;
}