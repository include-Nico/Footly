// js/state.js
export const gameState = {
    userTeam: {
        name: "",
        league: "",
        coins: 10000,
        colors: {
            primary: "#10b981", // Verde neon di default
            secondary: "#ffffff" // Bianco di default
        },
        kitStyle: "solid", // solid, stripes, halves
        players: []
    },
    currentView: "home"
};

// Funzione per salvare il gioco nel browser
export function saveGame() {
    localStorage.setItem('footly_save_data', JSON.stringify(gameState));
    console.log("Gioco salvato con successo!");
}

// Funzione per caricare il gioco all'avvio
export function loadGame() {
    const savedData = localStorage.getItem('footly_save_data');
    if (savedData) {
        // Se c'è un salvataggio, sovrascrive il gameState attuale con i dati salvati
        Object.assign(gameState, JSON.parse(savedData));
        return true; // Ritorna vero se ha caricato qualcosa
    }
    return false; // Ritorna falso se è la prima volta che gioca
}