// js/router.js
import { gameState, resetGame, saveGame } from './state.js';
import { updateDashboardHeader, showNotification } from './ui.js';
import { randomName } from './players.js'; // Importiamo la funzione per i cloni!

const mainContent = document.getElementById('main-content');
let selectedPlayerId = null; 
let draggedId = null; 

const FORMATIONS = {
    "2-3-1": { att: 0, def: 0, pos: [
        {role:'POR', t:'88%', l:'50%'}, 
        {role:'DIF', t:'70%', l:'30%'}, {role:'DIF', t:'70%', l:'70%'}, 
        {role:'CEN', t:'45%', l:'20%'}, {role:'CEN', t:'45%', l:'50%'}, {role:'CEN', t:'45%', l:'80%'}, 
        {role:'ATT', t:'15%', l:'50%'}
    ]},
    "3-2-1": { att: -10, def: 15, pos: [
        {role:'POR', t:'88%', l:'50%'}, 
        {role:'DIF', t:'70%', l:'20%'}, {role:'DIF', t:'70%', l:'50%'}, {role:'DIF', t:'70%', l:'80%'}, 
        {role:'CEN', t:'40%', l:'35%'}, {role:'CEN', t:'40%', l:'65%'}, 
        {role:'ATT', t:'15%', l:'50%'}
    ]},
    "2-2-2": { att: 15, def: -10, pos: [
        {role:'POR', t:'88%', l:'50%'}, 
        {role:'DIF', t:'72%', l:'30%'}, {role:'DIF', t:'72%', l:'70%'}, 
        {role:'CEN', t:'45%', l:'30%'}, {role:'CEN', t:'45%', l:'70%'}, 
        {role:'ATT', t:'18%', l:'35%'}, {role:'ATT', t:'18%', l:'65%'}
    ]},
    "1-4-1": { att: 5, def: 5, pos: [
        {role:'POR', t:'88%', l:'50%'}, 
        {role:'DIF', t:'75%', l:'50%'}, 
        {role:'CEN', t:'48%', l:'20%'}, {role:'CEN', t:'38%', l:'40%'}, {role:'CEN', t:'38%', l:'60%'}, {role:'CEN', t:'48%', l:'80%'}, 
        {role:'ATT', t:'15%', l:'50%'}
    ]}
};

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
        else if (viewName === 'market') renderMarket();

    } catch (error) {
        console.error("Errore router:", error);
        mainContent.innerHTML = `<div class="empty-view"><i class="fas fa-triangle-exclamation text-error"></i><h3>Errore</h3><p>Impossibile caricare la vista.</p></div>`;
    }
}

// ==========================================
// RENDER SQUADRA E VENDITA
// ==========================================
function renderSquad() {
    const pitch = document.getElementById('pitch-players');
    const bench = document.getElementById('bench-players');
    const formSelect = document.getElementById('formation-select');
    const attLabel = document.getElementById('tactics-att');
    const defLabel = document.getElementById('tactics-def');
    
    if(!pitch || !bench || !formSelect) return;

    if(!gameState.userTeam.formation) gameState.userTeam.formation = "2-3-1";
    formSelect.value = gameState.userTeam.formation;

    formSelect.onchange = (e) => {
        gameState.userTeam.formation = e.target.value;
        selectedPlayerId = null; 
        saveGame();
        renderSquad(); 
    };

    const currentF = FORMATIONS[gameState.userTeam.formation];
    attLabel.textContent = `ATT: ${currentF.att > 0 ? '+' : ''}${currentF.att}%`;
    defLabel.textContent = `DIF: ${currentF.def > 0 ? '+' : ''}${currentF.def}%`;

    pitch.innerHTML = '';
    bench.innerHTML = '';
    if (!gameState.userTeam.players) return;

    let starters = gameState.userTeam.players.filter(p => p.isStarter);
    let reserves = gameState.userTeam.players.filter(p => !p.isStarter);
    starters.forEach((p, idx) => { if(p.slotIndex === undefined) p.slotIndex = idx; });

    // Disegna Titolari sul Campo
    currentF.pos.forEach((slot, idx) => {
        let p = starters.find(pl => pl.slotIndex === idx);
        if (p) {
            const isOOP = (p.position !== slot.role) && !(p.secondaryPositions && p.secondaryPositions.includes(slot.role));
            let displayOverall = isOOP ? Math.floor(p.overall * 0.7) : p.overall;
            let warningHTML = isOOP ? `<div class="oop-warning" title="Fuori Ruolo! -30% Stats"><i class="fas fa-exclamation"></i></div>` : '';
            let isSelected = selectedPlayerId === p.id ? 'selected' : '';

            pitch.innerHTML += `
                <div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};">
                    <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.7); text-shadow: 0 1px 3px #000;">${slot.role}</div>
                    <div class="player-card player-card-interactive ${isSelected}" draggable="true" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                        ${warningHTML}
                        <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${displayOverall}</div>
                        <div class="card-pos">${p.position} ${p.secondaryPositions && p.secondaryPositions.length > 0 ? `<span style="font-size:8px; color:var(--text-hint)">(${p.secondaryPositions[0]})</span>` : ''}</div>
                        <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
                    </div>
                </div>
            `;
        } else {
            pitch.innerHTML += `
                <div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};">
                    <div class="empty-slot" data-idx="${idx}">
                        <i class="fas fa-plus"></i><br>${slot.role}
                    </div>
                </div>
            `;
        }
    });

    // Disegna Panchina CON BOTTONE SVINCOLO
    reserves.forEach(p => {
        let isSelected = selectedPlayerId === p.id ? 'selected' : '';
        let baseValue = p.value || (p.overall * 100); // Fallback per vecchi salvataggi
        let sellPrice = Math.floor(baseValue * 0.9); // Ritorni il 90% del valore

        bench.innerHTML += `
            <div class="player-card player-card-interactive ${isSelected}" draggable="true" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; position: relative;">
                
                <button class="sell-btn" data-id="${p.id}" data-price="${sellPrice}" data-name="${p.name}" style="position: absolute; top: -8px; left: -8px; background: var(--notif-error); color: white; border: 2px solid var(--bg-card); border-radius: 50%; width: 26px; height: 26px; font-size: 11px; cursor: pointer; z-index: 20; box-shadow: 0 2px 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;" title="Svincola a 💰${sellPrice.toLocaleString()}">💰</button>

                <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                <div class="card-pos">${p.position} ${p.secondaryPositions && p.secondaryPositions.length > 0 ? `<span style="font-size:8px; color:var(--text-hint)">(${p.secondaryPositions[0]})</span>` : ''}</div>
                <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
            </div>
        `;
    });

    // Evento Svincolo (Vendita)
    document.querySelectorAll('.sell-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation(); // Evita che il click selezioni la carta per lo scambio
            const id = btn.getAttribute('data-id');
            const price = parseInt(btn.getAttribute('data-price'));
            const name = btn.getAttribute('data-name');

            // Non permettere di vendere se la squadra scende sotto i 7 giocatori
            if(gameState.userTeam.players.length <= 7) {
                showNotification('Rosa Corta', 'Devi avere almeno 7 giocatori per scendere in campo!', 'error');
                return;
            }

            if(confirm(`Vuoi cedere ${name} per ${price.toLocaleString()} monete?`)) {
                gameState.userTeam.players = gameState.userTeam.players.filter(p => p.id !== id);
                gameState.userTeam.coins += price;
                saveGame();
                updateDashboardHeader();
                renderSquad(); 

                // Trova squadra random per la notifica
                let destTeam = "un club estero";
                if (gameState.userTeam.standings && gameState.userTeam.standings.length > 1) {
                    const cpuTeams = gameState.userTeam.standings.filter(t => !t.isUser);
                    if (cpuTeams.length > 0) destTeam = cpuTeams[Math.floor(Math.random() * cpuTeams.length)].name;
                }
                
                showNotification('Cessione Completata', `${name} si è trasferito al ${destTeam} per 💰 ${price.toLocaleString()}`, 'success', 6000);
            }
        };
    });

    // Logica di Scambio
    function executeSwap(id1, id2) {
        if(id1 === id2) return;
        let p1 = gameState.userTeam.players.find(pl => pl.id === id1);
        let p2 = gameState.userTeam.players.find(pl => pl.id === id2);
        let tempS = p1.isStarter; p1.isStarter = p2.isStarter; p2.isStarter = tempS;
        let tempIdx = p1.slotIndex; p1.slotIndex = p2.slotIndex; p2.slotIndex = tempIdx;
        saveGame(); renderSquad();
    }

    function executeMove(id, targetIdx) {
        let p1 = gameState.userTeam.players.find(pl => pl.id === id);
        p1.isStarter = true; p1.slotIndex = targetIdx;
        saveGame(); renderSquad();
    }

    // Applica Eventi Drag & Drop
    document.querySelectorAll('.player-card-interactive').forEach(card => {
        card.onclick = (e) => {
            e.stopPropagation(); 
            const id = card.getAttribute('data-id');
            if (!selectedPlayerId) { selectedPlayerId = id; renderSquad(); } 
            else {
                if (selectedPlayerId === id) selectedPlayerId = null;
                else executeSwap(selectedPlayerId, id);
                selectedPlayerId = null;
            }
        };

        card.addEventListener('dragstart', (e) => { draggedId = card.getAttribute('data-id'); setTimeout(() => card.style.opacity = '0.4', 0); });
        card.addEventListener('dragend', () => { card.style.opacity = '1'; draggedId = null; });
        card.addEventListener('dragover', (e) => e.preventDefault());
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetId = card.getAttribute('data-id');
            if (draggedId) executeSwap(draggedId, targetId);
        });

        card.addEventListener('touchstart', (e) => { draggedId = card.getAttribute('data-id'); card.style.opacity = '0.6'; }, {passive: true});
        card.addEventListener('touchend', (e) => {
            card.style.opacity = '1';
            if (!draggedId) return;
            const touch = e.changedTouches[0];
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            if (targetElement) {
                const targetCard = targetElement.closest('.player-card-interactive');
                const emptySlot = targetElement.closest('.empty-slot');
                if (targetCard) {
                    const targetId = targetCard.getAttribute('data-id');
                    if (targetId) executeSwap(draggedId, targetId);
                } else if (emptySlot) {
                    const targetIdx = parseInt(emptySlot.getAttribute('data-idx'));
                    executeMove(draggedId, targetIdx);
                }
            }
            draggedId = null;
        });
    });

    document.querySelectorAll('.empty-slot').forEach(slot => {
        slot.onclick = () => {
            const targetIdx = parseInt(slot.getAttribute('data-idx'));
            if (selectedPlayerId) { executeMove(selectedPlayerId, targetIdx); selectedPlayerId = null; }
        }
        slot.addEventListener('dragover', (e) => e.preventDefault());
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetIdx = parseInt(slot.getAttribute('data-idx'));
            if (draggedId) executeMove(draggedId, targetIdx);
        });
    });
}

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

function renderMarket() {
    const searchBtn = document.getElementById('market-search-btn');
    const resultsContainer = document.getElementById('market-results');
    if(!searchBtn || !resultsContainer) return;

    searchBtn.onclick = () => {
        const nameFilter = document.getElementById('market-search-name').value.toLowerCase();
        const posFilter = document.getElementById('market-pos').value;
        const rarityFilter = document.getElementById('market-rarity').value;

        let allPlayers = [];
        if(gameState.userTeam.standings) {
            gameState.userTeam.standings.forEach(team => {
                if(!team.isUser && team.roster) {
                    team.roster.forEach(p => { p.teamName = team.name; allPlayers.push(p); });
                }
            });
        }

        let filtered = allPlayers.filter(p => {
            if(nameFilter && !p.name.toLowerCase().includes(nameFilter)) return false;
            if(posFilter && p.position !== posFilter) return false;
            if(rarityFilter && p.rarity !== rarityFilter) return false;
            return true;
        });

        filtered.sort((a, b) => b.overall - a.overall);
        resultsContainer.innerHTML = '';
        if(filtered.length === 0) {
            resultsContainer.innerHTML = '<p style="color: var(--text-hint);">Nessun talento trovato.</p>';
            return;
        }

        filtered.slice(0, 30).forEach(p => {
            resultsContainer.innerHTML += `
                <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; width: 105px; padding: 8px;">
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                    <div class="card-pos">${p.position} <span style="font-size:8px;">${p.nationality}</span></div>
                    <div class="card-name" title="${p.name}" style="font-size: 10px; margin-bottom: 4px;">${p.name.split(' ')[1] || p.name}</div>
                    <div style="font-size: 8px; color: var(--text-muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; border-top: 1px solid var(--border-dim); padding-top: 4px;">${p.teamName}</div>
                    <button class="glass-btn buy-btn" data-id="${p.id}" data-team="${p.teamName}" data-price="${p.value}" style="padding: 6px; font-size: 11px; margin-top: 8px; width: 100%; border-color: var(--gold); color: var(--gold);">💰 ${p.value.toLocaleString()}</button>
                </div>
            `;
        });

        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.getAttribute('data-id');
                let baseValue = e.target.getAttribute('data-price');
                const price = parseInt(baseValue) || 100;
                const teamName = e.target.getAttribute('data-team');

                if(gameState.userTeam.coins >= price) {
                    if(confirm(`Procedere con l'acquisto per ${price.toLocaleString()} monete?`)) {
                        gameState.userTeam.coins -= price;

                        let boughtPlayer = null;
                        const cpuTeam = gameState.userTeam.standings.find(t => t.name === teamName);
                        if(cpuTeam) {
                            const pIndex = cpuTeam.roster.findIndex(p => p.id === id);
                            if(pIndex > -1) {
                                boughtPlayer = cpuTeam.roster.splice(pIndex, 1)[0];
                                
                                // LA CPU GENERA IL CLONE PER RIMPIAZZARE IL GIOCATORE VENDUTO!
                                let clonePlayer = JSON.parse(JSON.stringify(boughtPlayer));
                                clonePlayer.id = Math.random().toString(36).substr(2, 9);
                                clonePlayer.name = randomName(); // Nuovo nome casuale
                                cpuTeam.roster.push(clonePlayer);
                            }
                        }

                        if(boughtPlayer) {
                            boughtPlayer.isStarter = false; 
                            gameState.userTeam.players.push(boughtPlayer);
                            saveGame(); updateDashboardHeader();
                            showNotification('Colpo di Mercato!', `Hai acquistato ${boughtPlayer.name}! Controlla la rosa.`, 'success', 5000);
                            searchBtn.click(); 
                        }
                    }
                } else showNotification('Fondi Insufficienti', 'Non hai abbastanza monete.', 'error');
            };
        });
    };
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