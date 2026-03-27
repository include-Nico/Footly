// js/state.js
export const gameState = {
    userTeam: {
        name: "",
        league: "",
        division: 3, // Si parte dalla 3° Divisione!
        coins: 10000,
        colors: { primary: "#00f5a0", secondary: "#ffffff" },
        kitStyle: "solid",
        players: []
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
        Object.assign(gameState, JSON.parse(savedData));
        return true;
    }
    return false;
}