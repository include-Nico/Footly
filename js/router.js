// js/router.js
import { gameState } from './state.js';

const mainContent = document.getElementById('main-content');

export async function loadView(viewName) {
    try {
        // Mostra un caricamento visivo opzionale
        mainContent.innerHTML = `<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>`;
        
        // Pesca il file HTML corrispondente
        const response = await fetch(`views/${viewName}.html`);
        
        if (!response.ok) {
            throw new Error(`Impossibile caricare la vista: ${viewName}`);
        }
        
        // Converte la risposta in testo (HTML) e la inietta
        const html = await response.text();
        mainContent.innerHTML = html;
        
        // Riapplica i listener specifici della vista caricata
        attachViewListeners(viewName);

    } catch (error) {
        console.error("Errore nel Router:", error);
        mainContent.innerHTML = `
            <div class="glass-panel" style="padding: 20px; text-align: center; color: #ef4444;">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p>Errore caricamento schermata.</p>
            </div>`;
    }
}

// Riattacca gli eventi in base alla pagina caricata
function attachViewListeners(viewName) {
    if (viewName === 'home') {
        const playBtn = document.getElementById('play-match-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                alert("Simulazione motore di calcolo probabilità in avvio!");
            });
        }
    }
}