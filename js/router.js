// js/router.js
import { gameState, resetGame, saveGame } from './state.js';
import { updateDashboardHeader, showNotification, showConfirm, showPlayerInfo } from './ui.js';
import { randomName } from './players.js'; 

const mainContent = document.getElementById('main-content');
let selectedPlayerId = null; 
let draggedId = null; 

// Variabili Svincolo Multiplo
let isSvincoloMode = false;
let selectedForRelease = new Set();

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

        // Reset variabili stato view
        selectedPlayerId = null;
        isSvincoloMode = false;
        selectedForRelease.clear();

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
// SQUADRA, INFO, SVINCOLO E DRAG
// ==========================================
function renderSquad() {
    const pitch = document.getElementById('pitch-players');
    const bench = document.getElementById('bench-players');
    const formSelect = document.getElementById('formation-select');
    const attLabel = document.getElementById('tactics-att');
    const defLabel = document.getElementById('tactics-def');
    const btnInfo = document.getElementById('btn-info');
    const btnSvincolaMode = document.getElementById('btn-svincola-mode');
    const btnConfirmSvincolo = document.getElementById('btn-confirm-svincolo');
    
    if(!pitch || !bench || !formSelect) return;

    if(!gameState.userTeam.formation) gameState.userTeam.formation = "2-3-1";
    formSelect.value = gameState.userTeam.formation;

    formSelect.onchange = (e) => {
        gameState.userTeam.formation = e.target.value;
        selectedPlayerId = null; 
        saveGame(); renderSquad(); 
    };

    // Stile Modalità Svincolo
    if(isSvincoloMode) {
        btnSvincolaMode.style.background = 'rgba(240, 82, 82, 0.1)';
        btnSvincolaMode.style.borderColor = 'var(--notif-error)';
        btnSvincolaMode.style.color = 'var(--notif-error)';
        btnConfirmSvincolo.style.display = 'block';
        btnInfo.style.display = 'none';
        
        let totalGain = 0;
        selectedForRelease.forEach(id => {
            let p = gameState.userTeam.players.find(pl => pl.id === id);
            if(p) totalGain += Math.floor((p.value || p.overall*100) * 0.9);
        });
        btnConfirmSvincolo.textContent = `Conferma Svincolo (${selectedForRelease.size}) +💰${totalGain.toLocaleString()}`;
        if(selectedForRelease.size === 0) btnConfirmSvincolo.style.opacity = '0.5';
        else btnConfirmSvincolo.style.opacity = '1';
    } else {
        btnSvincolaMode.style.background = 'transparent';
        btnSvincolaMode.style.borderColor = 'var(--text-hint)';
        btnSvincolaMode.style.color = 'var(--text-muted)';
        btnConfirmSvincolo.style.display = 'none';
        
        if(selectedPlayerId) btnInfo.style.display = 'block';
        else btnInfo.style.display = 'none';
    }

    // Toggle Modalità Svincolo
    btnSvincolaMode.onclick = () => {
        isSvincoloMode = !isSvincoloMode;
        selectedPlayerId = null;
        selectedForRelease.clear();
        renderSquad();
    };

    // Logica Bottone Conferma Svincolo Multilpo
    btnConfirmSvincolo.onclick = () => {
        if(selectedForRelease.size === 0) return;
        
        let totalGain = 0;
        selectedForRelease.forEach(id => {
            let p = gameState.userTeam.players.find(pl => pl.id === id);
            if(p) totalGain += Math.floor((p.value || p.overall*100) * 0.9);
        });

        if(gameState.userTeam.players.length - selectedForRelease.size < 7) {
            showNotification('Rosa Corta', 'Devi avere almeno 7 giocatori per giocare.', 'error');
            return;
        }

        showConfirm("Svincolo Multiplo", `Stai per svincolare ${selectedForRelease.size} giocatori. Riclaverai 💰${totalGain.toLocaleString()} monete. Procedere?`, () => {
            gameState.userTeam.players = gameState.userTeam.players.filter(p => !selectedForRelease.has(p.id));
            gameState.userTeam.coins += totalGain;
            
            isSvincoloMode = false;
            selectedForRelease.clear();
            saveGame();
            updateDashboardHeader();
            renderSquad();
            showNotification('Operazione Completata', `Giocatori ceduti. Guadagno: 💰 ${totalGain.toLocaleString()}`, 'success');
        }, "Svincola Ora", true);
    };

    // Logica Bottone Info
    btnInfo.onclick = () => {
        if(selectedPlayerId) {
            let p = gameState.userTeam.players.find(pl => pl.id === selectedPlayerId);
            if(p) showPlayerInfo(p);
        }
    };

    const currentF = FORMATIONS[gameState.userTeam.formation];
    attLabel.textContent = `ATT: ${currentF.att > 0 ? '+' : ''}${currentF.att}%`;
    defLabel.textContent = `DIF: ${currentF.def > 0 ? '+' : ''}${currentF.def}%`;

    pitch.innerHTML = ''; bench.innerHTML = '';
    if (!gameState.userTeam.players) return;

    let starters = gameState.userTeam.players.filter(p => p.isStarter);
    let reserves = gameState.userTeam.players.filter(p => !p.isStarter);
    starters.forEach((p, idx) => { if(p.slotIndex === undefined) p.slotIndex = idx; });

    // Disegna Campo
    currentF.pos.forEach((slot, idx) => {
        let p = starters.find(pl => pl.slotIndex === idx);
        if (p) {
            const isOOP = (p.position !== slot.role) && !(p.secondaryPositions && p.secondaryPositions.includes(slot.role));
            let displayOverall = isOOP ? Math.floor(p.overall * 0.7) : p.overall;
            let warningHTML = isOOP ? `<div class="oop-warning" title="Fuori Ruolo! -30% Stats"><i class="fas fa-exclamation"></i></div>` : '';
            
            let isSelected = selectedPlayerId === p.id ? 'selected' : '';
            let dimmedClass = isSvincoloMode ? 'dimmed' : ''; // Oscura titolari in mod svincolo
            const flag = p.nationality ? p.nationality.split(' ')[0] : ''; // Estrae la bandierina

            pitch.innerHTML += `
                <div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};">
                    <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.7); text-shadow: 0 1px 3px #000;">${slot.role}</div>
                    <div class="player-card player-card-interactive ${isSelected} ${dimmedClass}" draggable="${!isSvincoloMode}" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                        ${warningHTML}
                        <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${displayOverall}</div>
                        <div class="card-pos">${p.position} <span style="font-size:10px;">${flag}</span></div>
                        <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
                    </div>
                </div>
            `;
        } else {
            pitch.innerHTML += `<div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};"><div class="empty-slot ${isSvincoloMode ? 'dimmed':''}" data-idx="${idx}"><i class="fas fa-plus"></i><br>${slot.role}</div></div>`;
        }
    });

    // Disegna Panchina
    reserves.forEach(p => {
        let cardClass = '';
        if(isSvincoloMode) cardClass = selectedForRelease.has(p.id) ? 'release-selected' : '';
        else cardClass = selectedPlayerId === p.id ? 'selected' : '';
        
        const flag = p.nationality ? p.nationality.split(' ')[0] : '';

        bench.innerHTML += `
            <div class="player-card player-card-interactive ${cardClass}" draggable="${!isSvincoloMode}" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                <div class="card-pos">${p.position} <span style="font-size:10px;">${flag}</span></div>
                <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
            </div>
        `;
    });

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

    // Applica Eventi a tutte le carte
    document.querySelectorAll('.player-card-interactive').forEach(card => {
        card.onclick = (e) => {
            e.stopPropagation(); 
            const id = card.getAttribute('data-id');
            
            // Logica se siamo in Modalità Svincolo
            if(isSvincoloMode) {
                let p = gameState.userTeam.players.find(pl => pl.id === id);
                if(p && p.isStarter) return; // Non puoi svincolare i titolari direttamente
                
                if(selectedForRelease.has(id)) selectedForRelease.delete(id);
                else selectedForRelease.add(id);
                renderSquad();
                return;
            }

            // Logica Normale (Scambio / Info)
            if (!selectedPlayerId) { selectedPlayerId = id; renderSquad(); } 
            else {
                if (selectedPlayerId === id) selectedPlayerId = null;
                else executeSwap(selectedPlayerId, id);
                selectedPlayerId = null;
                renderSquad();
            }
        };

        if(!isSvincoloMode) {
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
        }
    });

    document.querySelectorAll('.empty-slot').forEach(slot => {
        slot.onclick = () => {
            if(isSvincoloMode) return;
            const targetIdx = parseInt(slot.getAttribute('data-idx'));
            if (selectedPlayerId) { executeMove(selectedPlayerId, targetIdx); selectedPlayerId = null; renderSquad(); }
        }
        slot.addEventListener('dragover', (e) => e.preventDefault());
        slot.addEventListener('drop', (e) => {
            if(isSvincoloMode) return;
            e.preventDefault();
            const targetIdx = parseInt(slot.getAttribute('data-idx'));
            if (draggedId) executeMove(draggedId, targetIdx);
        });
    });
}

// ==========================================
// RENDER MERCATO, HOME, PROFILE
// ==========================================
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
            const flag = p.nationality ? p.nationality.split(' ')[0] : '';
            resultsContainer.innerHTML += `
                <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; width: 105px; padding: 8px; cursor:default;">
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                    <div class="card-pos">${p.position} <span style="font-size:10px;">${flag}</span></div>
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
                    // USO DEL NUOVO CUSTOM MODAL INVECE DI CONFIRM()
                    showConfirm("Conferma Acquisto", `Vuoi acquistare il giocatore per 💰${price.toLocaleString()} monete?`, () => {
                        gameState.userTeam.coins -= price;
                        let boughtPlayer = null;
                        const cpuTeam = gameState.userTeam.standings.find(t => t.name === teamName);
                        if(cpuTeam) {
                            const pIndex = cpuTeam.roster.findIndex(p => p.id === id);
                            if(pIndex > -1) {
                                boughtPlayer = cpuTeam.roster.splice(pIndex, 1)[0];
                                let clonePlayer = JSON.parse(JSON.stringify(boughtPlayer));
                                clonePlayer.id = Math.random().toString(36).substr(2, 9);
                                clonePlayer.name = randomName(); 
                                cpuTeam.roster.push(clonePlayer);
                            }
                        }
                        if(boughtPlayer) {
                            boughtPlayer.isStarter = false; 
                            gameState.userTeam.players.push(boughtPlayer);
                            saveGame(); updateDashboardHeader();
                            showNotification('Colpo di Mercato!', `Hai acquistato ${boughtPlayer.name}!`, 'success');
                            searchBtn.click(); 
                        }
                    });
                } else showNotification('Fondi Insufficienti', 'Non hai abbastanza monete.', 'error');
            };
        });
    };
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
            // USO DEL NUOVO CUSTOM MODAL
            showConfirm("Cancellazione Account", "⚠️ Sei sicuro di voler cancellare la tua squadra? Perderai tutto in modo irreversibile.", () => {
                resetGame();
            }, "Cancella Definitivamente", true);
        });
    }
}