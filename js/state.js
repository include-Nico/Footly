// js/state.js
export const gameState = {
    userTeam: {
        name: "",
        league: "",
        division: 3, // Si parte dalla 3° Divisione
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
        const parsedData = JSON.parse(savedData);
        
        // Uniamo i vecchi dati salvati con la struttura nuova
        Object.assign(gameState.userTeam, parsedData.userTeam);
        gameState.currentView = parsedData.currentView || "home";

        // FIX: Se il vecchio salvataggio non aveva la divisione, la impostiamo a 3
        if (!gameState.userTeam.division) {
            gameState.userTeam.division = 3;
            saveGame(); // Salviamo subito per correggere il file
        }
        
        return true;
    }
    return false;
}