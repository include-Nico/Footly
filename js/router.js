// js/router.js
import { gameState, resetGame } from './state.js';

const mainContent = document.getElementById('main-content');

export async function loadView(viewName) {
    try {
        const cacheBuster = new Date().getTime();
        const response = await fetch(`views/${viewName}.html?v=${cacheBuster}`);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        mainContent.innerHTML = html;

        if (viewName === 'home') {
            renderHome(); // NUOVA FUNZIONE PER LA HOME
        } else if (viewName === 'squad') {
            renderSquad();
        } else if (viewName === 'profile') {
            renderProfile();
        }

    } catch (error) {
        console.error("Errore router:", error);
        mainContent.innerHTML = `<div class="empty-view"><i class="fas fa-triangle-exclamation text-error"></i><h3>Errore</h3><p>Impossibile caricare la vista.</p></div>`;
    }
}

// Inizializza i dati nella vista HOME
function renderHome() {
    const teamNameEl = document.getElementById('home-team-name');
    const cpuTeamNameEl = document.getElementById('cpu-team-name');
    const divNumEl = document.getElementById('home-div-num');
    const tableBody = document.getElementById('league-table-body');

    if (teamNameEl) teamNameEl.textContent = gameState.userTeam.name;
    if (divNumEl) divNumEl.textContent = gameState.userTeam.division;

    // Ordiniamo la classifica per Punti (Dal più alto al più basso)
    if (gameState.userTeam.standings && gameState.userTeam.standings.length > 0) {
        let sortedStandings = [...gameState.userTeam.standings].sort((a, b) => b.points - a.points);
        
        // Assegniamo il prossimo avversario (la prima CPU disponibile per ora)
        const nextOpponent = sortedStandings.find(t => !t.isUser);
        if (cpuTeamNameEl && nextOpponent) cpuTeamNameEl.textContent = nextOpponent.name;

        if (tableBody) {
            tableBody.innerHTML = '';
            sortedStandings.forEach((team, index) => {
                const diffReti = team.goalsFor - team.goalsAgainst;
                const trStyle = team.isUser ? "background: rgba(0, 245, 160, 0.1); font-weight: bold; color: var(--accent);" : "";
                
                tableBody.innerHTML += `
                    <tr style="border-bottom: 1px solid var(--border-dim); ${trStyle}">
                        <td style="padding: 8px 4px;">${index + 1}</td>
                        <td style="padding: 8px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${team.name}</td>
                        <td style="padding: 8px 4px; text-align: center; font-weight: bold;">${team.points}</td>
                        <td style="padding: 8px 4px; text-align: center; color: var(--text-muted);">${team.played}</td>
                        <td style="padding: 8px 4px; text-align: center; color: var(--text-muted);">${diffReti > 0 ? '+'+diffReti : diffReti}</td>
                    </tr>
                `;
            });
        }
    }
}

function renderSquad() {
    const pitch = document.getElementById('pitch-players');
    const bench = document.getElementById('bench-players');
    
    if(!pitch || !bench) return;

    pitch.innerHTML = '';
    bench.innerHTML = '';

    if (!gameState.userTeam.players || gameState.userTeam.players.length === 0) return;

    gameState.userTeam.players.forEach(p => {
        const cardHTML = `
            <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                <div class="card-pos">${p.position}</div>
                <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
            </div>
        `;
        if (p.isStarter) pitch.innerHTML += cardHTML;
        else bench.innerHTML += cardHTML;
    });
}

function renderProfile() {
    const teamNameEl = document.getElementById('profile-team-name');
    const leagueDivEl = document.getElementById('profile-league-div');
    const coinsEl = document.getElementById('profile-coins');
    const playersCountEl = document.getElementById('profile-players-count');
    const deleteBtn = document.getElementById('delete-account-btn');

    if (teamNameEl) teamNameEl.textContent = gameState.userTeam.name;
    if (leagueDivEl) leagueDivEl.textContent = `${gameState.userTeam.league} · Div ${gameState.userTeam.division}`;
    if (coinsEl) coinsEl.textContent = gameState.userTeam.coins.toLocaleString('it-IT');
    if (playersCountEl && gameState.userTeam.players) playersCountEl.textContent = gameState.userTeam.players.length;

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const confirmDelete = confirm("⚠️ ATTENZIONE: Sei sicuro di voler cancellare la tua squadra?");
            if (confirmDelete) resetGame();
        });
    }
}