// js/router.js
import { gameState, resetGame, saveGame } from './state.js';
import { updateDashboardHeader, showNotification } from './ui.js';

const mainContent = document.getElementById('main-content');

export async function loadView(viewName) {
    try {
        const cacheBuster = new Date().getTime();
        const response = await fetch(`views/${viewName}.html?v=${cacheBuster}`);
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        mainContent.innerHTML = html;

        if (viewName === 'home') renderHome();
        else if (viewName === 'squad') renderSquad();
        else if (viewName === 'profile') renderProfile();
        else if (viewName === 'market') renderMarket(); // NUOVO RENDER MERCATO

    } catch (error) {
        console.error("Errore router:", error);
        mainContent.innerHTML = `<div class="empty-view"><i class="fas fa-triangle-exclamation text-error"></i><h3>Errore</h3><p>Impossibile caricare la vista.</p></div>`;
    }
}

// LOGICA CALCIOMERCATO
function renderMarket() {
    const searchBtn = document.getElementById('market-search-btn');
    const resultsContainer = document.getElementById('market-results');
    if(!searchBtn || !resultsContainer) return;

    searchBtn.onclick = () => {
        const nameFilter = document.getElementById('market-search-name').value.toLowerCase();
        const posFilter = document.getElementById('market-pos').value;
        const rarityFilter = document.getElementById('market-rarity').value;

        // Estrae tutti i giocatori delle squadre CPU
        let allPlayers = [];
        gameState.userTeam.standings.forEach(team => {
            if(!team.isUser && team.roster) {
                team.roster.forEach(p => {
                    p.teamName = team.name; // Tracciamo da che squadra proviene
                    allPlayers.push(p);
                });
            }
        });

        // Applica i filtri
        let filtered = allPlayers.filter(p => {
            if(nameFilter && !p.name.toLowerCase().includes(nameFilter)) return false;
            if(posFilter && p.position !== posFilter) return false;
            if(rarityFilter && p.rarity !== rarityFilter) return false;
            return true;
        });

        // Ordina per Overall (dal più forte al più scarso)
        filtered.sort((a, b) => b.overall - a.overall);

        resultsContainer.innerHTML = '';
        if(filtered.length === 0) {
            resultsContainer.innerHTML = '<p style="color: var(--text-hint);">Nessun talento trovato.</p>';
            return;
        }

        // Mostra i primi 30 giocatori trovati
        filtered.slice(0, 30).forEach(p => {
            resultsContainer.innerHTML += `
                <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; width: 105px; padding: 8px;">
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                    <div class="card-pos">${p.position} <span style="font-size:8px;">${p.nationality}</span></div>
                    <div class="card-name" title="${p.name}" style="font-size: 10px; margin-bottom: 4px;">${p.name.split(' ')[1] || p.name}</div>
                    <div style="font-size: 8px; color: var(--text-muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; border-top: 1px solid var(--border-dim); padding-top: 4px;">
                        ${p.teamName}
                    </div>
                    <button class="glass-btn buy-btn" data-id="${p.id}" data-team="${p.teamName}" data-price="${p.value}" style="padding: 6px; font-size: 11px; margin-top: 8px; width: 100%; border-color: var(--gold); color: var(--gold);">
                        💰 ${p.value.toLocaleString()}
                    </button>
                </div>
            `;
        });

        // Aggiunge la funzione d'acquisto ad ogni bottone generato
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.getAttribute('data-id');
                const price = parseInt(e.target.getAttribute('data-price'));
                const teamName = e.target.getAttribute('data-team');

                if(gameState.userTeam.coins >= price) {
                    if(confirm(`Procedere con l'acquisto per ${price.toLocaleString()} monete?`)) {
                        gameState.userTeam.coins -= price;

                        // Rimuove il giocatore dalla CPU e lo aggiunge alla tua rosa
                        let boughtPlayer = null;
                        const cpuTeam = gameState.userTeam.standings.find(t => t.name === teamName);
                        if(cpuTeam) {
                            const pIndex = cpuTeam.roster.findIndex(p => p.id === id);
                            if(pIndex > -1) {
                                boughtPlayer = cpuTeam.roster.splice(pIndex, 1)[0];
                            }
                        }

                        if(boughtPlayer) {
                            boughtPlayer.isStarter = false; // Va in panchina di default
                            gameState.userTeam.players.push(boughtPlayer);
                            saveGame();
                            updateDashboardHeader();
                            showNotification('Colpo di Mercato!', `Hai acquistato ${boughtPlayer.name}! Controlla la rosa.`, 'success', 5000);
                            searchBtn.click(); // Ricarica la lista
                        }
                    }
                } else {
                    showNotification('Fondi Insufficienti', 'Non hai abbastanza monete per questo acquisto.', 'error');
                }
            };
        });
    };
}

// Funzioni invariate
function renderHome() {
    const teamNameEl = document.getElementById('home-team-name');
    const cpuTeamNameEl = document.getElementById('cpu-team-name');
    const divNumEl = document.getElementById('home-div-num');
    const tableBody = document.getElementById('league-table-body');

    if (teamNameEl) teamNameEl.textContent = gameState.userTeam.name;
    if (divNumEl) divNumEl.textContent = gameState.userTeam.division;

    if (gameState.userTeam.standings && gameState.userTeam.standings.length > 0) {
        let sortedStandings = [...gameState.userTeam.standings].sort((a, b) => b.points - a.points);
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
    pitch.innerHTML = ''; bench.innerHTML = '';

    if (!gameState.userTeam.players) return;
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