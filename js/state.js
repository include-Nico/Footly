// js/state.js
export const gameState = {
    userTeam: {
        name: "",
        league: "",
        division: 3,
        coins: 10000,
        colors: { primary: "#00f5a0", secondary: "#ffffff" },
        kitStyle: "solid",
        players: [],
        standings: [] // NUOVO: La classifica del campionato!
    },
    currentView: "home"
};

export function saveGame() {
    localStorage.setItem('footly_save_data', JSON.stringify(gameState));
    console.log("Gioco salvato!");
}

export function loadGame() {
    const savedData = localStorage.getItem('footly_save_data');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        Object.assign(gameState.userTeam, parsedData.userTeam);
        gameState.currentView = parsedData.currentView || "home";

        if (!gameState.userTeam.division) {
            gameState.userTeam.division = 3;
            saveGame();
        }
        return true;
    }
    return false;
}

export function resetGame() {
    localStorage.removeItem('footly_save_data');
    location.reload(); 
}