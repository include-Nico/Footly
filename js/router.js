// js/router.js
import { gameState, resetGame, saveGame, getUserTeamStrength } from './state.js';
import { updateDashboardHeader, showNotification, showConfirm, showPlayerInfo } from './ui.js';
import { processEndOfSeason, generatePlayer, generateRandomNameByNation } from './players.js'; 

const mainContent = document.getElementById('main-content');
let selectedPlayerId = null; let draggedId = null; 
let isSvincoloMode = false; let selectedForRelease = new Set();

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const FORMATIONS = {
    "2-3-1": { att: 0, def: 0, pos: [{role:'POR', t:'88%', l:'50%'}, {role:'DIF', t:'70%', l:'30%'}, {role:'DIF', t:'70%', l:'70%'}, {role:'CEN', t:'45%', l:'20%'}, {role:'CEN', t:'45%', l:'50%'}, {role:'CEN', t:'45%', l:'80%'}, {role:'ATT', t:'15%', l:'50%'}] },
    "3-2-1": { att: -10, def: 15, pos: [{role:'POR', t:'88%', l:'50%'}, {role:'DIF', t:'70%', l:'20%'}, {role:'DIF', t:'70%', l:'50%'}, {role:'DIF', t:'70%', l:'80%'}, {role:'CEN', t:'40%', l:'35%'}, {role:'CEN', t:'40%', l:'65%'}, {role:'ATT', t:'15%', l:'50%'}] },
    "2-2-2": { att: 15, def: -10, pos: [{role:'POR', t:'88%', l:'50%'}, {role:'DIF', t:'72%', l:'30%'}, {role:'DIF', t:'72%', l:'70%'}, {role:'CEN', t:'45%', l:'30%'}, {role:'CEN', t:'45%', l:'70%'}, {role:'ATT', t:'18%', l:'35%'}, {role:'ATT', t:'18%', l:'65%'}] },
    "1-4-1": { att: 5, def: 5, pos: [{role:'POR', t:'88%', l:'50%'}, {role:'DIF', t:'75%', l:'50%'}, {role:'CEN', t:'48%', l:'20%'}, {role:'CEN', t:'38%', l:'40%'}, {role:'CEN', t:'38%', l:'60%'}, {role:'CEN', t:'48%', l:'80%'}, {role:'ATT', t:'15%', l:'50%'}] }
};

export async function loadView(viewName) {
    try {
        const cacheBuster = new Date().getTime();
        const response = await fetch(`views/${viewName}.html?v=${cacheBuster}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        mainContent.innerHTML = html;

        selectedPlayerId = null; isSvincoloMode = false; selectedForRelease.clear();

        if (viewName === 'home') renderHome();
        else if (viewName === 'squad') renderSquad();
        else if (viewName === 'profile') renderProfile();
        else if (viewName === 'market') renderMarket();
        else if (viewName === 'match') renderMatch();

    } catch (error) { console.error("Errore router:", error); }
}

function getStarsHTML(strength) {
    let stars = 0;
    if(strength >= 88) stars = 5; else if(strength >= 80) stars = 4; else if(strength >= 72) stars = 3; else if(strength >= 64) stars = 2; else if(strength >= 50) stars = 1;
    let html = '<div style="display:flex; gap:2px; color:var(--gold); font-size:10px; margin-top: 2px;">';
    for(let i=1; i<=5; i++) { if(i <= stars) html += '<i class="fas fa-star"></i>'; else html += '<i class="far fa-star" style="color:var(--border-dim);"></i>'; }
    html += '</div>'; return html;
}

// ==========================================
// 1. IL MOTORE DELLA PARTITA 4.0 (REALISMO MASSIMO)
// ==========================================
function renderMatch() {
    let minute = 0; let homeScore = 0; let awayScore = 0; let timerInterval;
    let isPaused = false; let subsLeft = 5; let tacBonusAtt = 0; let tacBonusDef = 0;

    const userStr = getUserTeamStrength();
    let opponents = gameState.world[gameState.userTeam.division];
    let oppIndex = (gameState.userTeam.matchday - 1) % opponents.length;
    let nextOpponent = opponents[oppIndex];

    document.getElementById('intro-matchday').textContent = gameState.userTeam.matchday;
    document.getElementById('intro-home-name').textContent = gameState.userTeam.name;
    document.getElementById('intro-away-name').textContent = nextOpponent.name;
    document.getElementById('intro-home-str').innerHTML = `${userStr} ${getStarsHTML(userStr)}`;
    document.getElementById('intro-away-str').innerHTML = `${nextOpponent.strength} ${getStarsHTML(nextOpponent.strength)}`;
    document.getElementById('score-home-name').textContent = gameState.userTeam.name.substring(0,3);
    document.getElementById('score-away-name').textContent = nextOpponent.name.substring(0,3);

    const unavailable = gameState.userTeam.players.filter(p => p.isStarter && (p.status.injured > 0 || p.status.suspended > 0));
    if(unavailable.length > 0) { showNotification("Indisponibili!", "Hai schierato titolari infortunati o squalificati!", "error"); setTimeout(() => loadView('squad'), 2000); return; }

    const logContainer = document.getElementById('match-log');
    function addLog(text, type = '') {
        const div = document.createElement('div'); div.className = `log-event ${type}`;
        div.innerHTML = `<span style="font-weight:bold; color:var(--text-hint); width:30px;">${minute}'</span> <span>${text}</span>`;
        logContainer.prepend(div);
    }

    // OCCASIONI FISSE (Max 4 a partita) calcolate prima del fischio d'inizio
    let totalChances = randomInt(2, 4); 
    let chanceMinutes = [];
    while(chanceMinutes.length < totalChances) {
        let m = randomInt(5, 88);
        if(!chanceMinutes.includes(m) && ![15, 30, 45, 60, 75].includes(m)) chanceMinutes.push(m);
    }

    document.getElementById('start-kickoff-btn').onclick = () => {
        document.getElementById('match-intro').style.display = 'none';
        document.getElementById('match-engine').style.display = 'flex';
        startTimer();
    };

    function startTimer() {
        isPaused = false;
        timerInterval = setInterval(() => {
            if(isPaused) return;
            minute++;
            document.getElementById('match-time').textContent = minute + "'";
            document.getElementById('match-progress').style.width = (minute / 90 * 100) + "%";

            // Eventi Dinamici ogni 15 minuti
            if(minute === 15 || minute === 30 || minute === 60 || minute === 75) triggerMatchEvent();
            
            // Pausa Fine Primo Tempo 
            if(minute === 45) { 
                isPaused = true; 
                addLog("Arbitro fischia la fine del primo tempo.");
                showConfirm("Intervallo", "Le squadre rientrano negli spogliatoi. Organizza le sostituzioni per il secondo tempo.", () => { 
                    document.getElementById('btn-pause-sub').click(); 
                }, "Gestione Squadra", false, true); 
            }

            if(minute >= 90) { clearInterval(timerInterval); endGame(); }
            if(!isPaused) simulateMinute();

        }, 150); 
    }

    function simulateMinute() {
        // Se è un minuto di occasione "pura"
        if (chanceMinutes.includes(minute)) {
            isPaused = true;
            
            let userWeight = userStr + tacBonusAtt;
            let cpuWeight = nextOpponent.strength - (tacBonusDef * 0.5);

            if(Math.random() * (userWeight + cpuWeight) < userWeight) {
                // Occasione Utente
                let shooter = getActivePlayer('ATT') || getActivePlayer();
                if(shooter) triggerGoalMiniGame(shooter, false);
                else { addLog("Azione sfumata per mancanza di attaccanti."); isPaused = false; }
            } else {
                // Occasione CPU (L'utente deve difendere)
                triggerGoalMiniGame(null, true);
            }
        }

        // Infortuni/Cartellini Casuali Molto Rari (0.5% al minuto)
        if(Math.random() < 0.005) {
            let active = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0 && p.status.injured === 0);
            if(active.length > 0) {
                let p = active[Math.floor(Math.random() * active.length)];
                let rand = Math.random();
                if(rand > 0.85) { p.status.injured = Math.floor(Math.random()*2)+1; addLog(`🤕 Brutto contrasto! <b>${p.name}</b> è infortunato!`, 'log-injury'); }
                else { p.status.yellowCards++; addLog(`🟨 Fallo a centrocampo, ammonito <b>${p.name}</b>.`, 'log-yellow'); }
            }
        }
    }

    function getActivePlayer(posFilter = null) {
        let active = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0 && p.status.injured === 0);
        if(posFilter) active = active.filter(p => p.position === posFilter);
        if(active.length === 0) active = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0);
        if(active.length === 0) return null;
        return active[Math.floor(Math.random() * active.length)];
    }

    // ==========================================
    // SISTEMA EVENTI DINAMICI
    // ==========================================
    function triggerMatchEvent() {
        isPaused = true;
        const modal = document.getElementById('event-modal');
        const titleEl = document.getElementById('event-title');
        const descEl = document.getElementById('event-desc');
        const optionsEl = document.getElementById('event-options');
        
        optionsEl.innerHTML = '';
        
        let pAtt = getActivePlayer('ATT') || getActivePlayer();
        let pCen = getActivePlayer('CEN') || getActivePlayer();
        let pDif = getActivePlayer('DIF') || getActivePlayer();
        
        let randEvent = Math.random();
        
        if (randEvent < 0.4) {
            // EVENTO ATTACCO
            titleEl.textContent = "Azione Pericolosa!";
            titleEl.style.color = "var(--accent)";
            descEl.innerHTML = `<b>${pAtt.name}</b> sale rapido sulla fascia e salta un uomo. La difesa avversaria è scoperta. Cosa gli diciamo di fare?`;
            
            addEventButton(`Cross in mezzo per ${pCen.name}`, () => {
                let successChance = (pCen.overall / 100) * 0.8; // Dipende dal ricevitore
                if(Math.random() < successChance) { addLog(`Cross perfetto!`); triggerGoalMiniGame(pCen, false); }
                else { addLog(`Cross fuori misura di ${pAtt.name}. Palla persa.`); isPaused = false; }
            });
            
            addEventButton(`Taglia al centro e tira`, () => {
                let successChance = (pAtt.overall / 100) * 0.7; // Tende ad essere più difficile da solo
                if(Math.random() < successChance) { addLog(`Si accentra benissimo!`); triggerGoalMiniGame(pAtt, false); }
                else { addLog(`${pAtt.name} viene fermato sul più bello dal difensore.`); isPaused = false; }
            });

        } else if (randEvent < 0.8) {
            // EVENTO DIFESA
            titleEl.textContent = "Contropiede Avversario!";
            titleEl.style.color = "var(--notif-warning)";
            descEl.innerHTML = `Palla persa malamente! La CPU riparte veloce. <b>${pDif.name}</b> è rimasto solo in marcatura.`;
            
            addEventButton(`Fallo Tattico (Rischio Cartellino)`, () => {
                let r = Math.random();
                if(r < 0.3) { 
                    pDif.status.suspended = 1; 
                    addLog(`🟥 CARTELLINO ROSSO! <b>${pDif.name}</b> espulso per fallo da ultimo uomo!`, 'log-red'); 
                    isPaused = false;
                } else {
                    pDif.status.yellowCards++; 
                    addLog(`🟨 Giallo per <b>${pDif.name}</b>. Contropiede intelligente fermato.`, 'log-yellow'); 
                    isPaused = false;
                }
            });
            
            addEventButton(`Difendi senza fare fallo`, () => {
                let successChance = (pDif.overall / 100) * 0.9;
                if(Math.random() < successChance) {
                    addLog(`Chiusura difensiva pazzesca di <b>${pDif.name}</b>! Pericolo scampato.`); isPaused = false;
                } else {
                    addLog(`<b>${pDif.name}</b> viene saltato di netto!`); 
                    triggerGoalMiniGame(null, true); // Va al tiro la CPU!
                }
            });

        } else {
            // EVENTO TATTICO / RIGORE
            if(Math.random() > 0.5) {
                titleEl.textContent = "Palla Inattiva";
                titleEl.style.color = "var(--gold)";
                descEl.innerHTML = `Calcio di punizione dal limite. Batte <b>${pCen.name}</b>.`;
                
                addEventButton(`Tiro a Giro`, () => {
                    if((pCen.overall / 100) > Math.random() + 0.2) { addLog("Che traiettoria!"); triggerGoalMiniGame(pCen, false); }
                    else { addLog(`La punizione di ${pCen.name} sbatte sulla barriera.`); isPaused = false; }
                });
                addEventButton(`Passaggio filtrante`, () => {
                    addLog("Schema su punizione non riuscito."); isPaused = false;
                });
            } else {
                titleEl.textContent = "Pressione!";
                descEl.innerHTML = `La squadra avversaria ci sta chiudendo nella nostra metà campo.`;
                addEventButton(`Tieni il possesso`, () => { tacBonusDef += 5; addLog("Possesso palla, ritmi addormentati."); isPaused = false; });
                addEventButton(`Spazza via`, () => { tacBonusAtt += 5; addLog("Lanci lunghi per spezzare il ritmo."); isPaused = false; });
            }
        }

        modal.classList.add('active');

        function addEventButton(text, callback) {
            let btn = document.createElement('button');
            btn.className = 'glass-btn'; btn.textContent = text;
            btn.style.textAlign = "left";
            btn.onclick = () => { modal.classList.remove('active'); callback(); };
            optionsEl.appendChild(btn);
        }
    }

    // ==========================================
    // GIOCO DEL TIRO (ATTACCO UTENTE O DIFESA UTENTE)
    // ==========================================
    function triggerGoalMiniGame(userShooterPlayer, isCPU) {
        const modal = document.getElementById('goal-modal');
        const titleEl = document.getElementById('goal-modal-title');
        const descEl = document.getElementById('shooter-name');
        const helpEl = document.getElementById('goal-helper-text');
        
        let shooterName = isCPU ? "Attaccante CPU" : userShooterPlayer.name;

        if (isCPU) {
            titleEl.textContent = "DIFENDI LA PORTA!";
            titleEl.style.color = "var(--notif-error)";
            descEl.textContent = `Tiro pericoloso di ${shooterName}!`;
            helpEl.textContent = "Tuffati! Clicca sull'angolo per parare!";
        } else {
            titleEl.textContent = "OCCASIONE GOL!";
            titleEl.style.color = "var(--accent)";
            descEl.textContent = `${shooterName} davanti alla porta!`;
            helpEl.textContent = "Scegli dove piazzarla!";
        }

        modal.classList.add('active');

        let isResolved = false;
        let shotTimer = setTimeout(() => {
            if(!isResolved) {
                modal.classList.remove('active');
                if(isCPU) {
                    awayScore++; document.getElementById('score-away').textContent = awayScore;
                    addLog(`⚽ Gol CPU! Il portiere è rimasto immobile.`, 'log-cpu-goal');
                } else {
                    addLog(`❌ Tempo scaduto! ${shooterName} incespica sul pallone.`);
                }
                isPaused = false;
            }
        }, 4000);

        const oldGrid = document.querySelector('.goal-grid');
        const newGrid = oldGrid.cloneNode(true);
        oldGrid.replaceWith(newGrid);

        newGrid.querySelectorAll('.goal-section').forEach((sec, idx) => {
            sec.onclick = function() {
                if(isResolved) return;
                isResolved = true; clearTimeout(shotTimer);
                
                if (isCPU) {
                    // UTENTE E' IL PORTIERE
                    let cpuTarget = Math.floor(Math.random() * 6);
                    
                    // Se l'utente becca l'angolo, PARA. 
                    // Se non lo becca, gol.
                    if(idx === cpuTarget) {
                        this.classList.add('goal-success'); 
                        addLog(`🧤 MIRACOLO! Tiro parato incredibilmente!`, 'log-goal');
                    } else {
                        // Bonus salvataggio in extremis del portiere base alla forza
                        let userGK = getActivePlayer('POR');
                        let saveChance = userGK ? (userGK.overall / 100) * 0.3 : 0.1;
                        
                        if(Math.random() < saveChance) {
                            this.classList.add('goal-success'); 
                            addLog(`🧤 Il portiere ci arriva con la punta delle dita! Parata!`, 'log-goal');
                        } else {
                            this.classList.add('goal-fail'); 
                            awayScore++; document.getElementById('score-away').textContent = awayScore;
                            addLog(`⚽ Gol della CPU. Tuffo dalla parte sbagliata.`, 'log-cpu-goal');
                        }
                    }
                } else {
                    // UTENTE TIRA
                    let baseSuccess = (userShooterPlayer.overall / 100) * 0.9;
                    if(userShooterPlayer.position === 'ATT') baseSuccess += 0.1;
                    if(userShooterPlayer.position === 'DIF') baseSuccess -= 0.2;

                    if(Math.random() < baseSuccess) {
                        this.classList.add('goal-success'); 
                        homeScore++; document.getElementById('score-home').textContent = homeScore;
                        addLog(`⚽ <b>GOOOAAALLLL!</b> Rete implacabile di <b>${userShooterPlayer.name}</b>!`, 'log-goal');
                    } else {
                        this.classList.add('goal-fail'); 
                        addLog(`❌ Parata del portiere avversario su tiro di ${userShooterPlayer.name}.`);
                    }
                }

                setTimeout(() => { this.classList.remove('goal-success', 'goal-fail'); modal.classList.remove('active'); isPaused = false; }, 1500);
            };
        });
    }


    // ==========================================
    // CAMPO 3D IN-GAME E SOSTITUZIONI
    // ==========================================
    document.getElementById('btn-pause-sub').onclick = () => {
        isPaused = true;
        const modal = document.getElementById('subs-modal');
        renderMatchSubsList();
        modal.classList.add('active');

        document.getElementById('close-subs-btn').onclick = () => {
            modal.classList.remove('active');
            isPaused = false;
        };
    };

    function renderMatchSubsList() {
        const pitch = document.getElementById('match-pitch-players');
        const bench = document.getElementById('match-bench-players');
        document.getElementById('subs-modal-left').textContent = subsLeft;
        pitch.innerHTML = ''; bench.innerHTML = '';
        
        const currentF = FORMATIONS[gameState.userTeam.formation];
        let starters = gameState.userTeam.players.filter(p => p.isStarter);
        let reserves = gameState.userTeam.players.filter(p => !p.isStarter);

        currentF.pos.forEach((slot, idx) => {
            let p = starters.find(pl => pl.slotIndex === idx);
            if(p) {
                const isOOP = (p.position !== slot.role) && !(p.secondaryPositions && p.secondaryPositions.includes(slot.role));
                let displayOverall = isOOP ? Math.floor(p.overall * 0.7) : p.overall;
                let warningHTML = isOOP ? `<div class="oop-warning" title="Fuori Ruolo!"><i class="fas fa-exclamation"></i></div>` : '';
                if(p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato!"><i class="fas fa-briefcase-medical"></i></div>`;
                if(p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Espulso!"><i class="fas fa-square"></i></div>`;
                
                let isSelected = selectedPlayerId === p.id ? 'selected' : '';
                let disabledClass = (p.status.suspended > 0) ? "disabled" : "";

                pitch.innerHTML += `
                    <div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};">
                        <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.7); text-shadow: 0 1px 3px #000;">${slot.role}</div>
                        <div class="player-card match-card-interactive ${isSelected} ${disabledClass}" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                            ${warningHTML}
                            <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${displayOverall}</div>
                            <div class="card-pos">${p.position}</div>
                            <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
                        </div>
                    </div>
                `;
            } else pitch.innerHTML += `<div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};"><div class="empty-slot" data-idx="${idx}"><i class="fas fa-plus"></i><br>${slot.role}</div></div>`;
        });

        reserves.forEach(p => {
            let isSelected = selectedPlayerId === p.id ? 'selected' : '';
            let warningHTML = '';
            if(p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato!"><i class="fas fa-briefcase-medical"></i></div>`;
            if(p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato!"><i class="fas fa-square"></i></div>`;
            let disabledClass = (p.status.suspended > 0 || p.status.injured > 0) ? "disabled" : "";

            bench.innerHTML += `
                <div class="player-card match-card-interactive ${isSelected} ${disabledClass}" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                    ${warningHTML}
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                    <div class="card-pos">${p.position}</div>
                    <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
                </div>
            `;
        });

        function executeMatchSwap(id1, id2) {
            if(id1 === id2) return;
            let p1 = gameState.userTeam.players.find(pl => pl.id === id1); 
            let p2 = gameState.userTeam.players.find(pl => pl.id === id2);
            
            if(p1.isStarter !== p2.isStarter) {
                if(subsLeft <= 0) { showNotification("Cambi Esauriti", "Hai finito le sostituzioni disponibili.", "error"); return; }
                subsLeft--;
                addLog(`🔄 Sostituzione: Esce ${p1.isStarter ? p1.name : p2.name}, entra ${p1.isStarter ? p2.name : p1.name}.`);
            }
            let tempS = p1.isStarter; p1.isStarter = p2.isStarter; p2.isStarter = tempS;
            let tempIdx = p1.slotIndex; p1.slotIndex = p2.slotIndex; p2.slotIndex = tempIdx;
            saveGame(); renderMatchSubsList();
        }

        document.querySelectorAll('.match-card-interactive').forEach(card => {
            if(card.classList.contains('disabled')) return;
            card.onclick = (e) => {
                e.stopPropagation(); 
                const id = card.getAttribute('data-id');
                if (!selectedPlayerId) { selectedPlayerId = id; renderMatchSubsList(); } 
                else { if (selectedPlayerId === id) selectedPlayerId = null; else executeMatchSwap(selectedPlayerId, id); selectedPlayerId = null; renderMatchSubsList(); }
            };
        });
    }

    function endGame() {
        gameState.userTeam.players.forEach(p => {
            if(p.isStarter && p.status.suspended === 0) p.stats.appearances++;
            if(p.status.injured > 0 && !p.isStarter) p.status.injured--;
            if(p.status.suspended > 0 && !p.isStarter) p.status.suspended--;
        });

        gameState.userTeam.stats.played++;
        gameState.userTeam.stats.goalsFor += homeScore;
        gameState.userTeam.stats.goalsAgainst += awayScore;
        let coinsEarned = homeScore * 50; 
        
        let title = "";
        if (homeScore > awayScore) { gameState.userTeam.stats.won++; gameState.userTeam.stats.points += 3; coinsEarned += 500; title="Vittoria!"; }
        else if (homeScore === awayScore) { gameState.userTeam.stats.drawn++; gameState.userTeam.stats.points += 1; coinsEarned += 200; title="Pareggio!"; }
        else { gameState.userTeam.stats.lost++; coinsEarned += 50; title="Sconfitta!"; }

        gameState.userTeam.coins += coinsEarned;

        nextOpponent.played++; nextOpponent.goalsFor += awayScore; nextOpponent.goalsAgainst += homeScore;
        if (awayScore > homeScore) { nextOpponent.won++; nextOpponent.points += 3; }
        else if (awayScore === homeScore) { nextOpponent.drawn++; nextOpponent.points += 1; }
        else { nextOpponent.lost++; }

        let otherCPUs = opponents.filter(t => t.name !== nextOpponent.name);
        for (let i = 0; i < otherCPUs.length; i += 2) {
            if(i+1 >= otherCPUs.length) break;
            let t1 = otherCPUs[i]; let t2 = otherCPUs[i+1];
            let t1Roll = Math.random() * (t1.strength + t2.strength);
            let g1 = 0, g2 = 0;
            if (t1Roll <= t1.strength) { g1 = Math.floor(Math.random()*3)+1; g2 = Math.floor(Math.random()*2); if(Math.random()>0.8) g2=g1; }
            else { g2 = Math.floor(Math.random()*3)+1; g1 = Math.floor(Math.random()*2); if(Math.random()>0.8) g1=g2; }
            t1.played++; t1.goalsFor += g1; t1.goalsAgainst += g2;
            if(g1 > g2) { t1.won++; t1.points += 3; } else if(g1 === g2) { t1.drawn++; t1.points += 1; } else { t1.lost++; }
            t2.played++; t2.goalsFor += g2; t2.goalsAgainst += g1;
            if(g2 > g1) { t2.won++; t2.points += 3; } else if(g2 === g1) { t2.drawn++; t2.points += 1; } else { t2.lost++; }
        }

        gameState.userTeam.matchday++;
        saveGame();
        showConfirm(title, `Partita conclusa: <b>${homeScore} - ${awayScore}</b><br><br>Hai guadagnato 💰${coinsEarned}.`, () => { loadView('home'); }, "Torna alla Dashboard", false, true); 
    }
}

// ==========================================
// 2. HOME E FINE STAGIONE
// ==========================================
function renderHome() {
    const teamNameEl = document.getElementById('home-team-name');
    const cpuTeamNameEl = document.getElementById('cpu-team-name');
    const divNumEl = document.getElementById('home-div-num');
    const tableBody = document.getElementById('league-table-body');
    const playBtn = document.getElementById('play-match-btn');
    const playBtnText = document.getElementById('play-btn-text');
    const playBtnIcon = document.getElementById('play-btn-icon');
    const matchdayCounter = document.getElementById('matchday-counter');

    if (teamNameEl) teamNameEl.textContent = gameState.userTeam.name;
    if (divNumEl) divNumEl.textContent = gameState.userTeam.division;
    if (matchdayCounter) matchdayCounter.textContent = gameState.userTeam.matchday <= 26 ? gameState.userTeam.matchday : 26;

    const userStr = getUserTeamStrength();
    const homeRatingEl = document.getElementById('home-team-rating');
    if (homeRatingEl) homeRatingEl.innerHTML = `<span style="font-weight:bold; font-size:12px;">${userStr}</span>${getStarsHTML(userStr)}`;

    const isEndOfSeason = gameState.userTeam.matchday > 26;
    let opponents = gameState.world[gameState.userTeam.division] || [];

    if (!isEndOfSeason && opponents.length > 0) {
        let oppIndex = (gameState.userTeam.matchday - 1) % opponents.length;
        let nextOpponent = opponents[oppIndex];
        
        if (cpuTeamNameEl) cpuTeamNameEl.textContent = nextOpponent.name;
        const cpuRatingEl = document.getElementById('cpu-team-rating');
        if (cpuRatingEl) cpuRatingEl.innerHTML = `<span style="font-weight:bold; font-size:12px;">${nextOpponent.strength}</span>${getStarsHTML(nextOpponent.strength)}`;
        document.getElementById('match-vs-badge').textContent = "VS";
        
        playBtnText.textContent = "Gioca Partita";
        playBtnIcon.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.style.background = "transparent";
        playBtn.style.color = "var(--accent)";
        playBtn.style.borderColor = "rgba(0,245,160,0.3)";
        
        playBtn.onclick = () => {
            if(userStr === 0) { showNotification("Rosa Incompleta", "Metti almeno 7 giocatori titolari in campo!", "error"); return; }
            loadView('match'); 
        };
    } else {
        if (cpuTeamNameEl) cpuTeamNameEl.textContent = "Stagione Conclusa";
        document.getElementById('cpu-team-rating').innerHTML = "";
        document.getElementById('match-vs-badge').textContent = "🏆";
        
        playBtnText.textContent = "Termina Stagione";
        playBtnIcon.innerHTML = '<i class="fas fa-forward-step"></i>';
        playBtn.style.background = "var(--gold)";
        playBtn.style.color = "#000";
        playBtn.style.borderColor = "var(--gold)";
        
        playBtn.onclick = () => { showConfirm("Fine Stagione", "Calcolo invecchiamento e premi...", () => { handleEndSeason(); }, "Procedi", false, true); };
    }

    if (opponents.length > 0) {
        let standings = [...opponents];
        standings.push({ name: gameState.userTeam.name, isUser: true, strength: userStr, points: gameState.userTeam.stats.points, played: gameState.userTeam.stats.played, goalsFor: gameState.userTeam.stats.goalsFor, goalsAgainst: gameState.userTeam.stats.goalsAgainst });
        let sortedStandings = standings.sort((a, b) => b.points - a.points);
        if (tableBody) {
            tableBody.innerHTML = '';
            sortedStandings.forEach((team, index) => {
                const trStyle = team.isUser ? "background: rgba(0, 245, 160, 0.1); font-weight: bold; color: var(--accent);" : "";
                tableBody.innerHTML += `
                    <tr style="border-bottom: 1px solid var(--border-dim); ${trStyle}">
                        <td style="padding: 8px 4px;">${index + 1}</td>
                        <td style="padding: 8px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${team.name}</td>
                        <td style="padding: 8px 4px; text-align: center;"><span style="font-weight:bold; font-size:11px; margin-right:4px;">${team.strength}</span>${getStarsHTML(team.strength)}</td>
                        <td style="padding: 8px 4px; text-align: center; font-weight: bold;">${team.points}</td>
                        <td style="padding: 8px 4px; text-align: center; color: var(--text-muted);">${team.played}</td>
                    </tr>
                `;
            });
        }
    }
}

function handleEndSeason() {
    let retirements = []; let evolutions = [];
    gameState.userTeam.players = gameState.userTeam.players.filter(p => {
        const result = processEndOfSeason(p);
        if (result.retired) { retirements.push(p.name); return false; }
        if (result.growth !== 0) evolutions.push(`${p.name} ${result.growth > 0 ? '+'+result.growth : result.growth}`);
        return true;
    });
    while(gameState.userTeam.players.length < 12) {
        let regen = generatePlayer('CEN', false, 'BRONZE', true); 
        regen.name = "Vivaio " + generateRandomNameByNation(regen.nationKey);
        gameState.userTeam.players.push(regen); evolutions.push(`${regen.name} (Nuovo)`);
    }

    [1, 2, 3].forEach(div => {
        if(gameState.world[div]) {
            gameState.world[div].forEach(team => {
                team.roster = team.roster.filter(p => !processEndOfSeason(p).retired);
                while(team.roster.length < 14) {
                    const pos = ['POR', 'DIF', 'DIF', 'CEN', 'CEN', 'ATT'][Math.floor(Math.random()*6)];
                    let rarity = div === 1 ? 'GOLD' : (div === 2 ? 'SILVER' : 'BRONZE');
                    team.roster.push(generatePlayer(pos, false, rarity, true));
                }
                team.strength = Math.floor(team.roster.slice(0,7).reduce((acc, p) => acc + p.overall, 0) / 7);
                team.points = 0; team.played = 0; team.won = 0; team.drawn = 0; team.lost = 0; team.goalsFor = 0; team.goalsAgainst = 0;
            });
        }
    });

    const reward = gameState.userTeam.stats.points * 150;
    gameState.userTeam.coins += reward;
    gameState.userTeam.stats = { points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
    gameState.userTeam.matchday = 1;
    saveGame(); updateDashboardHeader();
    showConfirm("🏆 Stagione Conclusa!", `<b>Premio:</b> 💰 <span style="color:var(--gold);">${reward.toLocaleString()}</span><br><br><b>Sviluppo Rosa:</b> <span style="color:var(--accent);">${evolutions.slice(0,5).join(', ')}...</span>`, () => { renderHome(); }, "Nuova Stagione", false, true);
}

// ==========================================
// 3. GESTIONE SQUADRA (FUORI PARTITA)
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
    formSelect.onchange = (e) => { gameState.userTeam.formation = e.target.value; selectedPlayerId = null; saveGame(); renderSquad(); };

    if(isSvincoloMode) {
        btnSvincolaMode.style.background = 'rgba(240, 82, 82, 0.1)'; btnSvincolaMode.style.borderColor = 'var(--notif-error)'; btnSvincolaMode.style.color = 'var(--notif-error)';
        btnConfirmSvincolo.style.display = 'block'; btnInfo.style.display = 'none';
        let totalGain = 0;
        selectedForRelease.forEach(id => { let p = gameState.userTeam.players.find(pl => pl.id === id); if(p) totalGain += Math.floor((p.value || p.overall*100) * 0.9); });
        btnConfirmSvincolo.textContent = `Conferma Svincolo (${selectedForRelease.size}) +💰${totalGain.toLocaleString()}`;
        btnConfirmSvincolo.style.opacity = selectedForRelease.size === 0 ? '0.5' : '1';
    } else {
        btnSvincolaMode.style.background = 'transparent'; btnSvincolaMode.style.borderColor = 'var(--text-hint)'; btnSvincolaMode.style.color = 'var(--text-muted)';
        btnConfirmSvincolo.style.display = 'none';
        btnInfo.style.display = selectedPlayerId ? 'block' : 'none';
    }

    btnSvincolaMode.onclick = () => { isSvincoloMode = !isSvincoloMode; selectedPlayerId = null; selectedForRelease.clear(); renderSquad(); };

    btnConfirmSvincolo.onclick = () => {
        if(selectedForRelease.size === 0) return;
        let totalGain = 0;
        selectedForRelease.forEach(id => { let p = gameState.userTeam.players.find(pl => pl.id === id); if(p) totalGain += Math.floor((p.value || p.overall*100) * 0.9); });

        if(gameState.userTeam.players.length - selectedForRelease.size < 7) { showNotification('Rosa Corta', 'Devi avere almeno 7 giocatori.', 'error'); return; }

        showConfirm("Svincolo Multiplo", `Stai per svincolare ${selectedForRelease.size} giocatori. Riclaverai 💰${totalGain.toLocaleString()}. Procedere?`, () => {
            gameState.userTeam.players = gameState.userTeam.players.filter(p => !selectedForRelease.has(p.id));
            gameState.userTeam.coins += totalGain;
            isSvincoloMode = false; selectedForRelease.clear(); saveGame(); updateDashboardHeader(); renderSquad();
            showNotification('Operazione Completata', `Guadagno: 💰 ${totalGain.toLocaleString()}`, 'success');
        }, "Svincola Ora", true);
    };

    btnInfo.onclick = () => { if(selectedPlayerId) { let p = gameState.userTeam.players.find(pl => pl.id === selectedPlayerId); if(p) showPlayerInfo(p); } };

    const currentF = FORMATIONS[gameState.userTeam.formation];
    attLabel.textContent = `ATT: ${currentF.att > 0 ? '+' : ''}${currentF.att}%`; defLabel.textContent = `DIF: ${currentF.def > 0 ? '+' : ''}${currentF.def}%`;

    pitch.innerHTML = ''; bench.innerHTML = '';
    if (!gameState.userTeam.players) return;

    let starters = gameState.userTeam.players.filter(p => p.isStarter);
    let reserves = gameState.userTeam.players.filter(p => !p.isStarter);
    starters.forEach((p, idx) => { if(p.slotIndex === undefined) p.slotIndex = idx; });

    currentF.pos.forEach((slot, idx) => {
        let p = starters.find(pl => pl.slotIndex === idx);
        if (p) {
            const isOOP = (p.position !== slot.role) && !(p.secondaryPositions && p.secondaryPositions.includes(slot.role));
            let displayOverall = isOOP ? Math.floor(p.overall * 0.7) : p.overall;
            let warningHTML = isOOP ? `<div class="oop-warning" title="Fuori Ruolo! -30% Stats"><i class="fas fa-exclamation"></i></div>` : '';
            if(p.status && p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato!"><i class="fas fa-briefcase-medical"></i></div>`;
            if(p.status && p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato!"><i class="fas fa-square"></i></div>`;

            let isSelected = selectedPlayerId === p.id ? 'selected' : '';
            let dimmedClass = isSvincoloMode ? 'dimmed' : ''; 
            const flag = p.nationality ? p.nationality.split(' ')[0] : ''; 

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
        } else pitch.innerHTML += `<div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};"><div class="empty-slot ${isSvincoloMode ? 'dimmed':''}" data-idx="${idx}"><i class="fas fa-plus"></i><br>${slot.role}</div></div>`;
    });

    reserves.forEach(p => {
        let cardClass = isSvincoloMode ? (selectedForRelease.has(p.id) ? 'release-selected' : '') : (selectedPlayerId === p.id ? 'selected' : '');
        const flag = p.nationality ? p.nationality.split(' ')[0] : '';
        let warningHTML = '';
        if(p.status && p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato per ${p.status.injured} turni"><i class="fas fa-briefcase-medical"></i></div>`;
        if(p.status && p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato per ${p.status.suspended} turni"><i class="fas fa-square"></i></div>`;

        bench.innerHTML += `
            <div class="player-card player-card-interactive ${cardClass}" draggable="${!isSvincoloMode}" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                ${warningHTML}
                <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                <div class="card-pos">${p.position} <span style="font-size:10px;">${flag}</span></div>
                <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
            </div>
        `;
    });

    function executeSwap(id1, id2) {
        if(id1 === id2) return;
        let p1 = gameState.userTeam.players.find(pl => pl.id === id1); let p2 = gameState.userTeam.players.find(pl => pl.id === id2);
        let tempS = p1.isStarter; p1.isStarter = p2.isStarter; p2.isStarter = tempS;
        let tempIdx = p1.slotIndex; p1.slotIndex = p2.slotIndex; p2.slotIndex = tempIdx;
        saveGame(); renderSquad();
    }
    function executeMove(id, targetIdx) {
        let p1 = gameState.userTeam.players.find(pl => pl.id === id); p1.isStarter = true; p1.slotIndex = targetIdx;
        saveGame(); renderSquad();
    }

    document.querySelectorAll('.player-card-interactive').forEach(card => {
        card.onclick = (e) => {
            e.stopPropagation(); 
            const id = card.getAttribute('data-id');
            if(isSvincoloMode) {
                let p = gameState.userTeam.players.find(pl => pl.id === id);
                if(p && p.isStarter) return; 
                if(selectedForRelease.has(id)) selectedForRelease.delete(id); else selectedForRelease.add(id);
                renderSquad(); return;
            }
            if (!selectedPlayerId) { selectedPlayerId = id; renderSquad(); } 
            else { if (selectedPlayerId === id) selectedPlayerId = null; else executeSwap(selectedPlayerId, id); selectedPlayerId = null; renderSquad(); }
        };

        if(!isSvincoloMode) {
            card.addEventListener('dragstart', (e) => { draggedId = card.getAttribute('data-id'); setTimeout(() => card.style.opacity = '0.4', 0); });
            card.addEventListener('dragend', () => { card.style.opacity = '1'; draggedId = null; });
            card.addEventListener('dragover', (e) => e.preventDefault());
            card.addEventListener('drop', (e) => { e.preventDefault(); const targetId = card.getAttribute('data-id'); if (draggedId) executeSwap(draggedId, targetId); });
            card.addEventListener('touchstart', (e) => { draggedId = card.getAttribute('data-id'); card.style.opacity = '0.6'; }, {passive: true});
            card.addEventListener('touchend', (e) => { card.style.opacity = '1'; if (!draggedId) return; const touch = e.changedTouches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); if (targetElement) { const targetCard = targetElement.closest('.player-card-interactive'); const emptySlot = targetElement.closest('.empty-slot'); if (targetCard) { const targetId = targetCard.getAttribute('data-id'); if (targetId) executeSwap(draggedId, targetId); } else if (emptySlot) { const targetIdx = parseInt(emptySlot.getAttribute('data-idx')); executeMove(draggedId, targetIdx); } } draggedId = null; });
        }
    });

    document.querySelectorAll('.empty-slot').forEach(slot => {
        slot.onclick = () => { if(isSvincoloMode) return; const targetIdx = parseInt(slot.getAttribute('data-idx')); if (selectedPlayerId) { executeMove(selectedPlayerId, targetIdx); selectedPlayerId = null; renderSquad(); } }
        slot.addEventListener('dragover', (e) => e.preventDefault());
        slot.addEventListener('drop', (e) => { if(isSvincoloMode) return; e.preventDefault(); const targetIdx = parseInt(slot.getAttribute('data-idx')); if (draggedId) executeMove(draggedId, targetIdx); });
    });
}

// ==========================================
// 4. MERCATO E PROFILO
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
        if(gameState.world) {
            [1, 2, 3].forEach(div => {
                if(gameState.world[div]) {
                    gameState.world[div].forEach(team => {
                        team.roster.forEach(p => { p.teamName = team.name; p.divLevel = div; allPlayers.push(p); });
                    });
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
        if(filtered.length === 0) { resultsContainer.innerHTML = '<p style="color: var(--text-hint);">Nessun talento trovato.</p>'; return; }

        filtered.slice(0, 30).forEach(p => {
            const flag = p.nationality ? p.nationality.split(' ')[0] : '';
            resultsContainer.innerHTML += `
                <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; width: 105px; padding: 8px; cursor:default; position:relative;">
                    <div style="position: absolute; top: -6px; left: -6px; background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 4px; padding: 2px 4px; font-size: 8px; color: var(--text-muted);">Div ${p.divLevel}</div>
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                    <div class="card-pos">${p.position} <span style="font-size:10px;">${flag}</span></div>
                    <div class="card-name" title="${p.name}" style="font-size: 10px; margin-bottom: 4px;">${p.name.split(' ')[1] || p.name}</div>
                    <div style="font-size: 8px; color: var(--text-muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; border-top: 1px solid var(--border-dim); padding-top: 4px;">${p.teamName}</div>
                    <button class="glass-btn buy-btn" data-id="${p.id}" data-team="${p.teamName}" data-div="${p.divLevel}" data-price="${p.value}" style="padding: 6px; font-size: 11px; margin-top: 8px; width: 100%; border-color: var(--gold); color: var(--gold);">💰 ${p.value.toLocaleString()}</button>
                </div>
            `;
        });

        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.getAttribute('data-id');
                const price = parseInt(e.target.getAttribute('data-price')) || 100;
                const teamName = e.target.getAttribute('data-team');
                const div = e.target.getAttribute('data-div');

                if(gameState.userTeam.coins >= price) {
                    showConfirm("Acquisto", `Vuoi acquistare il giocatore dal ${teamName} per 💰${price.toLocaleString()} monete?`, () => {
                        gameState.userTeam.coins -= price;
                        let boughtPlayer = null;
                        const cpuTeam = gameState.world[div].find(t => t.name === teamName);
                        
                        if(cpuTeam) {
                            const pIndex = cpuTeam.roster.findIndex(p => p.id === id);
                            if(pIndex > -1) {
                                boughtPlayer = cpuTeam.roster.splice(pIndex, 1)[0];
                                let clonePlayer = generatePlayer(boughtPlayer.position, false, 'BRONZE'); 
                                clonePlayer.name = generateRandomNameByNation(clonePlayer.nationKey);
                                cpuTeam.roster.push(clonePlayer);
                            }
                        }
                        
                        if(boughtPlayer) {
                            boughtPlayer.isStarter = false; 
                            gameState.userTeam.players.push(boughtPlayer);
                            saveGame(); updateDashboardHeader();
                            showNotification('Acquisto Completato!', `Hai acquistato ${boughtPlayer.name}!`, 'success');
                            searchBtn.click(); 
                        }
                    });
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
    
    const strEl = document.getElementById('profile-strength');
    const starsEl = document.getElementById('profile-stars');

    if (teamNameEl) teamNameEl.textContent = gameState.userTeam.name;
    if (leagueDivEl) leagueDivEl.textContent = `${gameState.userTeam.league} · Div ${gameState.userTeam.division}`;
    if (coinsEl) coinsEl.textContent = gameState.userTeam.coins.toLocaleString('it-IT');
    if (playersCountEl && gameState.userTeam.players) playersCountEl.textContent = gameState.userTeam.players.length;

    if (strEl && starsEl) {
        const str = getUserTeamStrength();
        strEl.textContent = str;
        starsEl.innerHTML = getStarsHTML(str);
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            showConfirm("Cancellazione Account", "⚠️ Sei sicuro di voler cancellare la tua squadra? Perderai tutto.", () => { resetGame(); }, "Cancella Definitivamente", true);
        });
    }
}
