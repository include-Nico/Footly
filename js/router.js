// js/router.js
import { gameState, resetGame, saveGame, getUserTeamStrength } from './state.js';
import { updateDashboardHeader, showNotification, showConfirm, showPlayerInfo } from './ui.js';
import { processEndOfSeason, generatePlayer, generateRandomNameByNation, getEffectiveOverall } from './players.js'; 

const mainContent = document.getElementById('main-content');
let selectedPlayerId = null; let draggedId = null; 

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

        selectedPlayerId = null;

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

function getPlayerPotential(age, overall) {
    if (age >= 30) return "📉 In Calo";
    if (age >= 26) return "➡️ Al Picco";
    if (age <= 21 && overall >= 75) return "⭐⭐⭐⭐⭐ Fenomeno";
    if (age <= 23 && overall >= 65) return "⭐⭐⭐⭐ Ottimo";
    if (age <= 25 && overall >= 55) return "⭐⭐⭐ Buono";
    return "⭐⭐ Discreto";
}

function getEnergyBarHTML(p) {
    if(p.energy === undefined) p.energy = 100;
    let color = p.energy > 70 ? '#00f5a0' : (p.energy > 40 ? '#f0b429' : '#f05252');
    return `
    <div style="width: 100%; height: 4px; background: rgba(0,0,0,0.5); border-radius: 2px; margin-top: 4px; overflow: hidden;" title="Energia: ${p.energy}%">
        <div style="height: 100%; width: ${p.energy}%; background: ${color}; transition: width 0.3s;"></div>
    </div>`;
}

// ==========================================
// 1. IL MOTORE DELLA PARTITA (MATCH ENGINE 8.0 - RECUPERO E FIX OVERLAP)
// ==========================================
function renderMatch() {
    let minute = 0; let homeScore = 0; let awayScore = 0; let timerInterval;
    let isPaused = false; let subsLeft = 5; let tacBonusAtt = 0; let tacBonusDef = 0; let redCards = 0;
    
    // Variabili per il Recupero (Stoppage Time)
    let stoppageTime = randomInt(2, 6);
    let addedTimeAnnounced = false;

    const userStr = getUserTeamStrength();
    let opponents = gameState.world[gameState.userTeam.league]?.[gameState.userTeam.division] || [];
    let oppIndex = (gameState.userTeam.matchday - 1) % opponents.length;
    let nextOpponent = opponents[oppIndex];
    let cpuDynamicStrength = nextOpponent.strength;

    function updateMatchHeaderStr() {
        const userStr = getUserTeamStrength(); 
        document.getElementById('intro-home-str').innerHTML = `${userStr} ${getStarsHTML(userStr)}`;
    }
    
    document.getElementById('intro-matchday').textContent = gameState.userTeam.matchday;
    document.getElementById('intro-home-name').textContent = gameState.userTeam.name;
    document.getElementById('intro-away-name').textContent = nextOpponent.name;
    updateMatchHeaderStr();
    document.getElementById('intro-away-str').innerHTML = `${nextOpponent.strength} ${getStarsHTML(nextOpponent.strength)}`;
    document.getElementById('score-home-name').textContent = gameState.userTeam.name.substring(0,3);
    document.getElementById('score-away-name').textContent = nextOpponent.name.substring(0,3);

    gameState.userTeam.players.forEach(p => { if(!p.status) p.status = { injured: 0, suspended: 0, yellowCards: 0 }; });
    const unavailable = gameState.userTeam.players.filter(p => p.isStarter && (p.status.injured > 0 || p.status.suspended > 0));
    if(unavailable.length > 0) { showNotification("Indisponibili!", "Hai schierato titolari infortunati o squalificati!", "error"); setTimeout(() => loadView('squad'), 2000); return; }

    const logContainer = document.getElementById('match-log');
    function addLog(text, type = '') {
        const div = document.createElement('div'); div.className = `log-event ${type}`;
        let displayMin = minute > 90 ? `90+${minute-90}'` : `${minute}'`;
        div.innerHTML = `<span style="font-weight:bold; color:var(--text-hint); width:35px;">${displayMin}</span> <span>${text}</span>`;
        logContainer.prepend(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    function showMatchBanner(type, mainText, subText, callback) {
        const banner = document.getElementById('match-banner');
        const titleEl = document.getElementById('match-banner-text');
        const detailsEl = document.getElementById('match-banner-details');

        if (!banner || !titleEl || !detailsEl) { 
            if(callback) callback(); 
            return; 
        }

        titleEl.textContent = mainText;
        detailsEl.innerHTML = subText;
        titleEl.style.color = "white"; 
        titleEl.style.textShadow = "0 4px 20px rgba(255, 255, 255, 0.4)";

        if (type === 'goal-user') {
            titleEl.style.color = "var(--accent)";
            titleEl.style.textShadow = "0 4px 20px rgba(0, 245, 160, 0.6)";
        } else if (type === 'goal-cpu') {
            titleEl.style.color = "var(--notif-error)";
            titleEl.style.textShadow = "0 4px 20px rgba(240, 82, 82, 0.6)";
        } else if (type === 'yellow') {
            titleEl.style.color = "var(--gold)";
            titleEl.style.textShadow = "0 4px 20px rgba(240, 180, 41, 0.6)";
        } else if (type === 'red') {
            titleEl.style.color = "var(--notif-error)";
            titleEl.style.textShadow = "0 4px 20px rgba(240, 82, 82, 0.6)";
        } else if (type === 'injury') {
            titleEl.style.color = "#f43f5e";
            titleEl.style.textShadow = "0 4px 20px rgba(244, 63, 94, 0.6)";
        } else if (type === 'info') {
            titleEl.style.color = "var(--text-primary)";
        }

        banner.classList.add('show');
        setTimeout(() => { 
            banner.classList.remove('show'); 
            if(callback) callback(); 
        }, 3000);
    }

    // PRE-CALCOLO OCCASIONI NORMALI E RECUPERO
    let totalChances = randomInt(2, 4); 
    let chanceMinutes = [];
    while(chanceMinutes.length < totalChances) {
        let m = randomInt(5, 88);
        if(!chanceMinutes.includes(m) && ![15, 30, 45, 60, 75, 90].includes(m)) chanceMinutes.push(m);
    }
    
    // Dramma dell'ultimo minuto: 40% di possibilità di occasione nel recupero
    if(Math.random() > 0.6) {
        chanceMinutes.push(90 + randomInt(1, stoppageTime));
    }

    document.getElementById('start-kickoff-btn').onclick = () => {
        document.getElementById('match-intro').style.display = 'none';
        document.getElementById('match-engine').style.display = 'flex';
        startTimer();
    };

    function startTimer() {
        isPaused = false;
        // RALLENTATO IL GIOCO: Da 150ms a 400ms per permettere di leggere
        timerInterval = setInterval(() => {
            if(isPaused) return;
            
            minute++;
            
            // Aggiorna UI Tempo
            if(minute > 90) {
                document.getElementById('match-time').textContent = `90+${minute-90}'`;
            } else {
                document.getElementById('match-time').textContent = minute + "'";
            }
            document.getElementById('match-progress').style.width = (Math.min(minute, 90) / 90 * 100) + "%";

            // EVENTI PROGRAMMATI
            if(minute === 15 || minute === 30 || minute === 60 || minute === 75) {
                triggerMatchEvent();
            }
            else if(minute === 45) { 
                isPaused = true; 
                addLog("L'arbitro fischia la fine del primo tempo.");
                showConfirm("Intervallo", "Le squadre rientrano negli spogliatoi. Organizza le sostituzioni.", () => { 
                    document.getElementById('btn-pause-sub').click(); 
                }, "Gestione Squadra", false, true); 
            }
            else if(minute === 90 && !addedTimeAnnounced) {
                isPaused = true;
                addedTimeAnnounced = true;
                addLog(`L'arbitro segnala ${stoppageTime} minuti di recupero.`);
                showMatchBanner('info', 'RECUPERO', `+${stoppageTime} Minuti`, () => { isPaused = false; });
            }
            else if(minute >= 90 + stoppageTime) { 
                clearInterval(timerInterval); 
                isPaused = true; 
                addLog("Triplice fischio! La partita è finita.");
                setTimeout(endGame, 1500); 
                return; 
            }
            else { 
                simulateMinute(); 
            }

        }, 400); 
    }

    function simulateMinute() {
        // FATICA
        gameState.userTeam.players.filter(p => p.isStarter).forEach(p => {
            let fatigueChance = p.position === 'POR' ? 0.05 : 0.4;
            if(Math.random() < fatigueChance && p.energy > 0) p.energy--;
        });
        cpuDynamicStrength = Math.max(cpuDynamicStrength * 0.998, nextOpponent.strength * 0.8);

        // 1. GESTIONE OCCASIONI
        if (chanceMinutes.includes(minute)) {
            isPaused = true; // Ferma il timer
            const currentF = FORMATIONS[gameState.userTeam.formation];
            let totalTacAtt = tacBonusAtt + currentF.att;
            let totalTacDef = tacBonusDef + currentF.def;
            
            let currentUserStr = getUserTeamStrength(); 
            let userWeight = currentUserStr + totalTacAtt;
            let cpuWeight = cpuDynamicStrength - (totalTacDef * 0.5);

            if(Math.random() * (userWeight + cpuWeight) < userWeight) {
                let shooter = getRandomShooter();
                let assister = null;
                if (Math.random() > 0.4) {
                    assister = getActivePlayer(['CEN', 'ATT']);
                    if (assister && shooter && assister.id === shooter.id) assister = null;
                }
                if(shooter) triggerGoalMiniGame(shooter, false, assister);
                else { addLog("Azione sfumata per mancanza di giocatori offensivi."); isPaused = false; }
            } else {
                let oppShooter = getRandomOpponentPlayer(['ATT', 'CEN']) || getRandomOpponentPlayer();
                let oppAssister = null;
                if (Math.random() > 0.4) {
                    oppAssister = getRandomOpponentPlayer(['CEN', 'ATT']);
                    if (oppAssister && oppShooter && oppAssister.id === oppShooter.id) oppAssister = null;
                }
                triggerGoalMiniGame(oppShooter, true, oppAssister);
            }
            
            return; // IMPORTANTE: Esce qui così non genera anche un cartellino in questo stesso minuto
        }

        // 2. GESTIONE CARTELLINI (Avviene solo se NON c'è stata un'occasione)
        if(Math.random() < 0.01) {
            let active = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0 && p.status.injured === 0);
            if(active.length > 0) {
                let p = active[Math.floor(Math.random() * active.length)];
                let rand = Math.random();
                isPaused = true; // Ferma il timer per mostrare il banner!
                
                if(rand > 0.85) { 
                    p.status.injured = Math.floor(Math.random()*2)+1; 
                    addLog(`🤕 Brutto contrasto! <b>${p.name}</b> è infortunato!`, 'log-injury'); 
                    showMatchBanner('injury', 'INFORTUNIO', `🤕 ${p.name} deve uscire!`, () => { isPaused = false; });
                }
                else { 
                    p.stats.yellowCards++; 
                    addLog(`🟨 Fallo a centrocampo, ammonito <b>${p.name}</b>.`, 'log-yellow'); 
                    showMatchBanner('yellow', 'AMMONIZIONE', `🟨 ${p.name}`, () => { isPaused = false; });
                }
            }
        }
    }

    function getActivePlayer(roles = null) {
        let active = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0 && p.status.injured === 0);
        if(active.length === 0) return null;
        if(roles) {
            let filtered = active.filter(p => roles.includes(p.position));
            if(filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)];
        }
        return active[Math.floor(Math.random() * active.length)];
    }

    function getRandomShooter() {
        let roll = Math.random();
        if(roll < 0.55) return getActivePlayer(['ATT']) || getActivePlayer(['CEN']) || getActivePlayer();
        if(roll < 0.90) return getActivePlayer(['CEN']) || getActivePlayer(['ATT']) || getActivePlayer();
        return getActivePlayer(['DIF']) || getActivePlayer();
    }

    function getRandomOpponentPlayer(roles = null) {
        let roster = nextOpponent.roster;
        if(roles) {
            let filtered = roster.filter(p => roles.includes(p.position));
            if(filtered.length > 0) return filtered[Math.floor(Math.random() * filtered.length)];
        }
        return roster[Math.floor(Math.random() * roster.length)];
    }

    function getMultipleActivePlayers(count) {
        let active = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0 && p.status.injured === 0);
        let selected = [];
        for(let i=0; i<count; i++) {
            if(active.length === 0) break;
            let idx = Math.floor(Math.random() * active.length);
            selected.push(active[idx]);
            active.splice(idx, 1);
        }
        return selected;
    }

    function triggerMatchEvent() {
        isPaused = true;
        const modal = document.getElementById('event-modal');
        const titleEl = document.getElementById('event-title');
        const descEl = document.getElementById('event-desc');
        const optionsEl = document.getElementById('event-options');
        optionsEl.innerHTML = '';
        
        let pOff = getActivePlayer(['ATT', 'CEN']) || getActivePlayer();
        let pDef = getActivePlayer(['DIF', 'CEN']) || getActivePlayer();
        
        let randEvent = Math.random();
        
        if (randEvent < 0.4) {
            titleEl.textContent = "Azione Pericolosa!"; titleEl.style.color = "var(--accent)";
            let offVerbs = ["sale prepotentemente sulla fascia", "trova un varco centrale", "avanza palla al piede", "supera un avversario con una finta"];
            let offVerb = offVerbs[Math.floor(Math.random() * offVerbs.length)];
            descEl.innerHTML = `<b>${pOff.name}</b> ${offVerb}. La difesa è scoperta. Cosa gli diciamo di fare?`;
            
            let companions = getMultipleActivePlayers(2);
            companions.forEach(comp => {
                if(comp.id === pOff.id) return;
                let successChance = (getEffectiveOverall(comp) / 100) * 0.8;
                addEventButton(`Passa la palla a ${comp.name} (${comp.position})`, () => {
                    if(Math.random() < successChance) { addLog(`Passaggio illuminante per ${comp.name}!`); triggerGoalMiniGame(comp, false, pOff); }
                    else { addLog(`Passaggio intercettato per ${comp.name}. Palla persa.`); isPaused = false; }
                });
            });
            
            addEventButton(`Cerca la conclusione personale`, () => {
                let successChance = (getEffectiveOverall(pOff) / 100) * 0.7; 
                if(Math.random() < successChance) { addLog(`${pOff.name} si libera lo specchio della porta!`); triggerGoalMiniGame(pOff, false, null); }
                else { addLog(`${pOff.name} viene murato al momento del tiro.`); isPaused = false; }
            });

        } else if (randEvent < 0.8) {
            titleEl.textContent = "Contropiede Avversario!"; titleEl.style.color = "var(--notif-warning)";
            descEl.innerHTML = `Lancio lungo improvviso! Gli avversari ripartono veloci. <b>${pDef.name}</b> è l'ultimo uomo rimasto in difesa.`;
            
            addEventButton(`Fallo Tattico (Rischio Cartellino)`, () => {
                let r = Math.random();
                if(r < 0.3) { 
                    pDef.status.suspended = 1; pDef.stats.redCards++; redCards++; 
                    addLog(`🟥 ROSSO! <b>${pDef.name}</b> espulso per fallo da ultimo uomo!`, 'log-red'); 
                    showMatchBanner('red', 'ESPULSO', `🟥 ${pDef.name}`, () => { isPaused = false; });
                } else { 
                    pDef.stats.yellowCards++; 
                    addLog(`🟨 Giallo per <b>${pDef.name}</b>. Contropiede fermato con le cattive.`, 'log-yellow'); 
                    showMatchBanner('yellow', 'AMMONIZIONE', `🟨 ${pDef.name}`, () => { isPaused = false; });
                }
            });
            
            addEventButton(`Difendi temporeggiando (Rischio Gol)`, () => {
                let successChance = (getEffectiveOverall(pDef) / 100) * 0.85;
                if(Math.random() < successChance) { addLog(`Chiusura difensiva magistrale di <b>${pDef.name}</b>! Pericolo scampato.`); isPaused = false; } 
                else { 
                    addLog(`<b>${pDef.name}</b> viene saltato di netto! L'attaccante si invola.`); 
                    let oppShooter = getRandomOpponentPlayer(['ATT', 'CEN']) || getRandomOpponentPlayer();
                    triggerGoalMiniGame(oppShooter, true, null); 
                }
            });
        } else {
            titleEl.textContent = "Fallo in Area!"; titleEl.style.color = "var(--gold)";
            if(Math.random() > 0.5) {
                descEl.innerHTML = `L'arbitro indica il dischetto a tuo favore!`;
                addEventButton(`Calcia il Rigore`, () => { triggerPenalty(true); });
            } else {
                descEl.innerHTML = `Intervento scomposto in area. Rigore per il ${nextOpponent.name}!`;
                addEventButton(`Vai in Porta`, () => { triggerPenalty(false); });
            }
        }

        modal.classList.add('active');

        function addEventButton(text, callback) {
            let btn = document.createElement('button');
            btn.className = 'glass-btn'; btn.textContent = text; btn.style.textAlign = "left";
            btn.onclick = () => { modal.classList.remove('active'); callback(); };
            optionsEl.appendChild(btn);
        }
    }

    function triggerPenalty(isUserShooter) {
        const modal = document.getElementById('goal-modal');
        let userShooter = isUserShooter ? (getRandomShooter() || getActivePlayer()) : null;
        let oppShooter = getRandomOpponentPlayer(['ATT', 'CEN']) || getRandomOpponentPlayer();
        let shooterName = isUserShooter ? (userShooter?.name || "Tuo Giocatore") : oppShooter.name;
        
        document.getElementById('goal-modal-title').textContent = isUserShooter ? "RIGORE A FAVORE!" : "RIGORE CONTRO!";
        document.getElementById('goal-modal-title').style.color = isUserShooter ? "var(--accent)" : "var(--notif-error)";
        document.getElementById('shooter-name').textContent = isUserShooter ? `${shooterName} sul dischetto.` : "Tuffati per parare!";
        document.getElementById('goal-helper-text').textContent = isUserShooter ? "Scegli l'angolo dove tirare!" : "Indovina l'angolo!";
        
        modal.classList.add('active');
        let isShotTaken = false;
        
        let shotTimer = setTimeout(() => {
            if(!isShotTaken) {
                modal.classList.remove('active');
                if(isUserShooter) {
                    addLog(`❌ Tempo scaduto! ${shooterName} scivola sul dischetto.`);
                    isPaused = false;
                } else { 
                    awayScore++; document.getElementById('score-away').textContent = awayScore; 
                    addLog(`⚽ Gol di ${shooterName} su rigore. Sei rimasto immobile.`, 'log-cpu-goal'); 
                    showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}`, () => { isPaused = false; });
                }
            }
        }, 5000);

        const oldGrid = document.querySelector('.goal-grid');
        const newGrid = oldGrid.cloneNode(true);
        oldGrid.replaceWith(newGrid);

        newGrid.querySelectorAll('.goal-section').forEach((sec, idx) => {
            sec.onclick = function() {
                if(isShotTaken) return;
                isShotTaken = true; clearTimeout(shotTimer);
                let cpuZone = Math.floor(Math.random() * 6);
                
                if(isUserShooter) {
                    if(idx === cpuZone) { 
                        this.classList.add('goal-fail'); addLog(`❌ Rigore PARATO! Il portiere intuisce l'angolo.`, 'log-red'); 
                        setTimeout(() => { this.classList.remove('goal-fail'); modal.classList.remove('active'); isPaused = false; }, 1500);
                    } else { 
                        this.classList.add('goal-success'); homeScore++; document.getElementById('score-home').textContent = homeScore; 
                        if(userShooter) userShooter.stats.goals++;
                        addLog(`⚽ <b>GOOOAAALLLL!</b> Rigore perfetto di ${shooterName}!`, 'log-goal'); 
                        setTimeout(() => { 
                            this.classList.remove('goal-success'); modal.classList.remove('active'); 
                            showMatchBanner('goal-user', 'GOOOOAL!', `⚽ ${shooterName}`, () => { isPaused = false; });
                        }, 1500);
                    }
                } else {
                    if(idx === cpuZone) { 
                        this.classList.add('goal-success'); addLog(`🧤 MIRACOLO! Hai parato il rigore intuendo l'angolo giusto!`, 'log-goal'); 
                        setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); isPaused = false; }, 1500);
                    } else { 
                        this.classList.add('goal-fail'); awayScore++; document.getElementById('score-away').textContent = awayScore; 
                        addLog(`⚽ Gol di ${shooterName}. Portiere spiazzato.`, 'log-cpu-goal'); 
                        setTimeout(() => { 
                            this.classList.remove('goal-fail'); modal.classList.remove('active'); 
                            showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}`, () => { isPaused = false; });
                        }, 1500);
                    }
                }
            };
        });
    }

    function triggerGoalMiniGame(shooterPlayer, isCPU, assisterPlayer = null) {
        const modal = document.getElementById('goal-modal');
        const titleEl = document.getElementById('goal-modal-title');
        const descEl = document.getElementById('shooter-name');
        const helpEl = document.getElementById('goal-helper-text');
        
        let shooterName = isCPU ? shooterPlayer.name : shooterPlayer.name;

        if (isCPU) {
            titleEl.textContent = "DIFENDI LA PORTA!"; titleEl.style.color = "var(--notif-error)";
            descEl.textContent = `Tiro pericoloso di ${shooterName}!`; helpEl.textContent = "Tuffati! Clicca sull'angolo per parare!";
        } else {
            titleEl.textContent = "OCCASIONE GOL!"; titleEl.style.color = "var(--accent)";
            descEl.textContent = `${shooterName} davanti alla porta!`; helpEl.textContent = "Scegli dove piazzarla!";
        }

        modal.classList.add('active');

        let isResolved = false;
        let shotTimer = setTimeout(() => {
            if(!isResolved) {
                modal.classList.remove('active');
                if(isCPU) { 
                    awayScore++; document.getElementById('score-away').textContent = awayScore; 
                    addLog(`⚽ Gol di ${shooterName}! Il portiere è rimasto immobile.`, 'log-cpu-goal'); 
                    let astText = assisterPlayer ? `<br><span style="font-size:12px; color:white;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
                    showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}${astText}`, () => { isPaused = false; });
                } 
                else { addLog(`❌ Tempo scaduto! ${shooterName} incespica sul pallone.`); isPaused = false; }
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
                    let cpuTarget = Math.floor(Math.random() * 6);
                    if(idx === cpuTarget) {
                        this.classList.add('goal-success'); addLog(`🧤 MIRACOLO! Tiro parato incredibilmente!`, 'log-goal');
                        setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); isPaused = false; }, 1500);
                    } else {
                        let userGK = getActivePlayer(['POR']); 
                        let saveChance = userGK ? (getEffectiveOverall(userGK) / 100) * 0.3 : 0.1;
                        if(Math.random() < saveChance) { 
                            this.classList.add('goal-success'); addLog(`🧤 Il portiere ci arriva con la punta delle dita! Parata!`, 'log-goal'); 
                            setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); isPaused = false; }, 1500);
                        } else { 
                            this.classList.add('goal-fail'); awayScore++; document.getElementById('score-away').textContent = awayScore; 
                            addLog(`⚽ Gol di ${shooterName}. Tuffo dalla parte sbagliata.`, 'log-cpu-goal'); 
                            setTimeout(() => { 
                                this.classList.remove('goal-fail'); modal.classList.remove('active'); 
                                let astText = assisterPlayer ? `<br><span style="font-size:12px; color:white;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
                                showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}${astText}`, () => { isPaused = false; });
                            }, 1500);
                        }
                    }
                } else {
                    const currentF = FORMATIONS[gameState.userTeam.formation];
                    let totalTacAtt = tacBonusAtt + currentF.att;
                    
                    let baseSuccess = (getEffectiveOverall(shooterPlayer) / 100) * 0.9;
                    if(shooterPlayer.position === 'ATT') baseSuccess += 0.1; 
                    if(shooterPlayer.position === 'DIF') baseSuccess -= 0.2;
                    baseSuccess += (totalTacAtt / 100) * 0.5;

                    if(Math.random() < baseSuccess) {
                        this.classList.add('goal-success'); homeScore++; document.getElementById('score-home').textContent = homeScore;
                        shooterPlayer.stats.goals++;
                        if(assisterPlayer) assisterPlayer.stats.assists++;
                        addLog(`⚽ <b>GOOOAAALLLL!</b> Rete implacabile di <b>${shooterPlayer.name}</b>!`, 'log-goal');
                        
                        setTimeout(() => { 
                            this.classList.remove('goal-success'); modal.classList.remove('active'); 
                            let astText = assisterPlayer ? `<br><span style="font-size:12px; color:white;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
                            showMatchBanner('goal-user', 'GOOOOAL!', `⚽ ${shooterPlayer.name}${astText}`, () => { isPaused = false; });
                        }, 1500);
                    } else {
                        this.classList.add('goal-fail'); addLog(`❌ Parata del portiere avversario su tiro di ${shooterPlayer.name}.`);
                        setTimeout(() => { this.classList.remove('goal-fail'); modal.classList.remove('active'); isPaused = false; }, 1500);
                    }
                }
            };
        });
    }

    document.getElementById('btn-pause-sub').onclick = () => {
        isPaused = true;
        const modal = document.getElementById('subs-modal');
        const matchFormSelect = document.getElementById('match-formation-select');
        
        if (matchFormSelect) {
            matchFormSelect.value = gameState.userTeam.formation;
            matchFormSelect.onchange = (e) => {
                gameState.userTeam.formation = e.target.value;
                selectedPlayerId = null; saveGame(); renderMatchSubsList(); updateMatchHeaderStr(); 
                addLog(`🔄 Cambio Modulo: L'allenatore passa al ${gameState.userTeam.formation}.`);
            };
        }

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
        
        const currentF = FORMATIONS[gameState.userTeam.formation];
        let totalTacAtt = tacBonusAtt + currentF.att;
        let totalTacDef = tacBonusDef + currentF.def;
        document.getElementById('match-tactics-att').textContent = `ATT: ${totalTacAtt > 0 ? '+' : ''}${totalTacAtt}%`;
        document.getElementById('match-tactics-def').textContent = `DIF: ${totalTacDef > 0 ? '+' : ''}${totalTacDef}%`;

        pitch.innerHTML = ''; bench.innerHTML = '';
        
        let starters = gameState.userTeam.players.filter(p => p.isStarter);
        let reserves = gameState.userTeam.players.filter(p => !p.isStarter);

        currentF.pos.forEach((slot, idx) => {
            let p = starters.find(pl => pl.slotIndex === idx);
            if(p) {
                const isOOP = (p.position !== slot.role) && !(p.secondaryPositions && p.secondaryPositions.includes(slot.role));
                let displayOverall = isOOP ? Math.floor(getEffectiveOverall(p) * 0.7) : getEffectiveOverall(p);
                let warningHTML = isOOP ? `<div class="oop-warning" title="Fuori Ruolo!"><i class="fas fa-exclamation"></i></div>` : '';
                if(p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato!"><i class="fas fa-briefcase-medical"></i></div>`;
                if(p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Espulso!"><i class="fas fa-square"></i></div>`;
                
                let isSelected = selectedPlayerId === p.id ? 'selected' : '';
                let disabledClass = (p.status.suspended > 0) ? "disabled" : "";
                const flag = p.nationality ? p.nationality.split(' ')[0] : ''; 

                pitch.innerHTML += `
                    <div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};">
                        <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.7); text-shadow: 0 1px 3px #000;">${slot.role}</div>
                        <div class="player-card match-card-interactive ${isSelected} ${disabledClass}" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                            ${warningHTML}
                            <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${displayOverall}</div>
                            <div class="card-pos">${p.position}</div>
                            ${getEnergyBarHTML(p)}
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
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${getEffectiveOverall(p)}</div>
                    <div class="card-pos">${p.position}</div>
                    ${getEnergyBarHTML(p)}
                    <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
                </div>
            `;
        });

        function executeMatchSwap(id1, id2) {
            if(id1 === id2) return;
            let p1 = gameState.userTeam.players.find(pl => pl.id === id1); let p2 = gameState.userTeam.players.find(pl => pl.id === id2);
            
            if(p1.isStarter !== p2.isStarter) {
                if(subsLeft <= 0) { showNotification("Cambi Esauriti", "Hai finito le sostituzioni disponibili.", "error"); return; }
                subsLeft--;
                addLog(`🔄 Sostituzione: Esce ${p1.isStarter ? p1.name : p2.name}, entra ${p1.isStarter ? p2.name : p1.name}.`);
            }
            let tempS = p1.isStarter; p1.isStarter = p2.isStarter; p2.isStarter = tempS;
            let tempIdx = p1.slotIndex; p1.slotIndex = p2.slotIndex; p2.slotIndex = tempIdx;
            saveGame(); renderMatchSubsList(); updateMatchHeaderStr();
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

    function processCpuTeam(team) {
        team.roster.forEach(p => {
            if(p.energy === undefined) p.energy = 100;
            if(Math.random() < 0.7) p.energy = Math.max(10, p.energy - randomInt(30, 50)) + randomInt(20, 40); 
            else p.energy = Math.min(100, p.energy + randomInt(50, 80)); 
        });
        let best = [...team.roster].sort((a,b) => getEffectiveOverall(b) - getEffectiveOverall(a)).slice(0,7);
        team.strength = Math.floor(best.reduce((acc, p) => acc + getEffectiveOverall(p), 0) / 7);
    }

    function endGame() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        document.getElementById('match-engine').style.display = 'none'; 

        gameState.userTeam.players.forEach(p => {
            if(p.isStarter) {
                if(p.status.suspended === 0) {
                    p.stats.appearances++;
                    if(awayScore === 0 && (p.position === 'POR' || p.position === 'DIF')) {
                        p.stats.cleanSheets = (p.stats.cleanSheets || 0) + 1;
                    }
                }
                p.energy += randomInt(20, 40); 
            } else {
                p.energy += randomInt(80, 100); 
            }
            if(p.energy > 100) p.energy = 100;
            
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

        processCpuTeam(nextOpponent);
        nextOpponent.played++; nextOpponent.goalsFor += awayScore; nextOpponent.goalsAgainst += homeScore;
        if (awayScore > homeScore) { nextOpponent.won++; nextOpponent.points += 3; }
        else if (awayScore === homeScore) { nextOpponent.drawn++; nextOpponent.points += 1; }
        else { nextOpponent.lost++; }

        for (const lg in gameState.world) {
            [1, 2, 3].forEach(div => {
                if(gameState.world[lg][div]) {
                    let teams = gameState.world[lg][div];
                    if (lg === gameState.userTeam.league && div === gameState.userTeam.division) {
                        let otherCPUs = teams.filter(t => t.name !== nextOpponent.name);
                        for (let i = 0; i < otherCPUs.length; i += 2) {
                            if(i+1 >= otherCPUs.length) break;
                            simulateGlobalMatch(otherCPUs[i], otherCPUs[i+1]);
                        }
                    } else {
                        for(let i=0; i<teams.length; i+=2) {
                            if(i+1 >= teams.length) break;
                            simulateGlobalMatch(teams[i], teams[i+1]);
                        }
                    }
                }
            });
        }

        gameState.userTeam.matchday++;
        saveGame();

        showConfirm(title, `Partita conclusa: <b>${homeScore} - ${awayScore}</b><br><br>Hai guadagnato 💰${coinsEarned}.`, () => {
            loadView('home');
        }, "Torna alla Dashboard", false, true); 
    }

    function simulateGlobalMatch(t1, t2) {
        processCpuTeam(t1); processCpuTeam(t2);
        let t1Roll = Math.random() * (t1.strength + t2.strength);
        let g1 = 0, g2 = 0;
        if (t1Roll <= t1.strength) { g1 = Math.floor(Math.random()*3)+1; g2 = Math.floor(Math.random()*2); if(Math.random()>0.8) g2=g1; }
        else { g2 = Math.floor(Math.random()*3)+1; g1 = Math.floor(Math.random()*2); if(Math.random()>0.8) g1=g2; }
        
        t1.played++; t1.goalsFor += g1; t1.goalsAgainst += g2;
        if(g1 > g2) { t1.won++; t1.points += 3; } else if(g1 === g2) { t1.drawn++; t1.points += 1; } else { t1.lost++; }
        
        t2.played++; t2.goalsFor += g2; t2.goalsAgainst += g1;
        if(g2 > g1) { t2.won++; t2.points += 3; } else if(g2 === g1) { t2.drawn++; t2.points += 1; } else { t2.lost++; }
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
    let opponents = gameState.world[gameState.userTeam.league]?.[gameState.userTeam.division] || [];

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
                        <td style="padding: 8px 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${team.name}</td>
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

    for (const lg in gameState.world) {
        [1, 2, 3].forEach(div => {
            if(gameState.world[lg][div]) {
                gameState.world[lg][div].forEach(team => {
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
    }

    const reward = gameState.userTeam.stats.points * 150;
    gameState.userTeam.coins += reward;
    gameState.userTeam.stats = { points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
    gameState.userTeam.matchday = 1;
    saveGame(); updateDashboardHeader();
    showConfirm("🏆 Stagione Conclusa!", `<b>Premio:</b> 💰 <span style="color:var(--gold);">${reward.toLocaleString()}</span><br><br><b>Sviluppo Rosa:</b> <span style="color:var(--accent);">${evolutions.slice(0,5).join(', ')}...</span>`, () => { renderHome(); }, "Nuova Stagione", false, true);
}

// ==========================================
// 3. GESTIONE SQUADRA (FUORI PARTITA E HUB)
// ==========================================
function renderSquad() {
    const pitch = document.getElementById('pitch-players');
    const bench = document.getElementById('bench-players');
    const formSelect = document.getElementById('formation-select');
    const attLabel = document.getElementById('tactics-att');
    const defLabel = document.getElementById('tactics-def');
    const btnOpenHub = document.getElementById('btn-open-hub');
    const hubModal = document.getElementById('hub-modal');
    const closeHubBtn = document.getElementById('close-hub-btn');
    const hubContent = document.getElementById('hub-content');
    
    if(!pitch || !bench || !formSelect) return;

    if(!gameState.userTeam.formation) gameState.userTeam.formation = "2-3-1";
    formSelect.value = gameState.userTeam.formation;
    formSelect.onchange = (e) => { gameState.userTeam.formation = e.target.value; selectedPlayerId = null; saveGame(); renderSquad(); };

    btnOpenHub.onclick = () => { renderHubList(); hubModal.classList.add('active'); };
    closeHubBtn.onclick = () => { hubModal.classList.remove('active'); renderSquad(); };

    function renderHubList() {
        hubContent.innerHTML = '';
        let allPlayers = [...gameState.userTeam.players].sort((a,b) => b.overall - a.overall);
        
        allPlayers.forEach(p => {
            const flag = p.nationality ? p.nationality.split(' ')[0] : '';
            const statusIcon = p.isStarter ? `<i class="fas fa-shirt text-accent" title="Titolare"></i>` : `<i class="fas fa-chair text-hint" title="Panchina"></i>`;
            let item = document.createElement('div');
            item.className = 'hub-list-item';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="card-overall" style="color:${p.color}; font-size:22px;">${p.overall}</div>
                    <div>
                        <div style="font-weight:bold; font-size:14px; color:var(--text-primary);">${p.name}</div>
                        <div style="font-size:10px; color:var(--text-muted);">${flag} ${p.position} · Età: ${p.age}</div>
                    </div>
                </div>
                <div>${statusIcon}</div>
            `;
            item.onclick = () => renderHubPlayerDetail(p);
            hubContent.appendChild(item);
        });
    }

    function renderHubPlayerDetail(p) {
        hubContent.innerHTML = '';
        let val = p.value || p.overall * 100;
        let pot = getPlayerPotential(p.age, p.overall);
        let tBoost = p.trainingBoost || 0;
        let trainCost = 500 * (tBoost + 1);
        let roleTrainCost = 1500;

        let backBtn = document.createElement('button');
        backBtn.className = 'glass-btn'; backBtn.style.marginBottom = '15px';
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Torna alla Lista';
        backBtn.onclick = () => renderHubList();
        hubContent.appendChild(backBtn);

        let detailsHtml = `
            <div style="border: 2px solid ${p.color}; border-radius: var(--radius-md); padding: 15px; margin-bottom: 20px; background: rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                    <div>
                        <h2 style="color: ${p.color}; margin-bottom:4px; font-size: 22px;">${p.name}</h2>
                        <div style="font-size: 12px; color: var(--text-primary); font-weight: bold;">${p.nationality} · ${p.age} anni</div>
                        <div style="font-size: 11px; color: var(--text-hint); margin-top: 4px;">Ruoli: ${p.position} ${p.secondaryPositions && p.secondaryPositions.length > 0 ? `(${p.secondaryPositions.join(', ')})` : ''}</div>
                    </div>
                    <div class="card-overall" style="color: ${p.color}; font-size: 36px; text-shadow: 0 0 15px ${p.color}80;">${p.overall}</div>
                </div>
                <div class="divider" style="margin: 12px 0; background: ${p.color}40;"></div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                    <div><span style="color:var(--text-hint);">Qualità:</span> <b style="color:${p.color};">${p.rarity}</b></div>
                    <div><span style="color:var(--text-hint);">Valore:</span> <b style="color:var(--gold);">💰 ${val.toLocaleString()}</b></div>
                    <div><span style="color:var(--text-hint);">Pres / Gol / Ass:</span> <b>${p.stats.appearances} / ${p.stats.goals} / ${p.stats.assists}</b></div>
                    <div><span style="color:var(--text-hint);">Cartellini:</span> <b>🟨 ${p.stats.yellowCards || 0} / 🟥 ${p.stats.redCards || 0}</b></div>
                    <div style="grid-column: span 2;"><span style="color:var(--text-hint);">Potenziale:</span> <b>${pot}</b></div>
                </div>
                ${tBoost > 0 ? `<div style="margin-top:10px; font-size:11px; color:var(--accent); text-align:center;"><i class="fas fa-dumbbell"></i> Allenamento Stagionale: +${tBoost}</div>` : ''}
            </div>

            <div class="section-label">Sviluppo e Gestione</div>
            <button id="btn-train-stats" class="glass-btn hub-action-btn" style="border-color: var(--accent); color: var(--text-primary);">
                <div><div><i class="fas fa-dumbbell text-accent"></i> Allenamento Fisico</div><div class="hub-action-desc">Migliora le chance di crescita a fine stagione.</div></div>
                <div style="color: var(--gold); font-weight:bold;">💰 ${trainCost}</div>
            </button>
            <button id="btn-train-role" class="glass-btn hub-action-btn" style="border-color: var(--notif-info); color: var(--text-primary);">
                <div><div><i class="fas fa-brain text-info" style="color: var(--notif-info);"></i> Allenamento Tattico</div><div class="hub-action-desc">30% di chance di imparare un nuovo ruolo.</div></div>
                <div style="color: var(--gold); font-weight:bold;">💰 ${roleTrainCost}</div>
            </button>
            <div class="divider" style="margin: 20px 0;"></div>
            <button id="btn-sell-player" class="glass-btn hub-action-btn" style="background: rgba(240,82,82,0.1); border-color: var(--notif-error); color: var(--notif-error); justify-content: center;">
                <i class="fas fa-trash-can"></i> Svincola Giocatore (Ricavo: 💰 ${Math.floor(val * 0.9).toLocaleString()})
            </button>
        `;
        
        const detailsContainer = document.createElement('div');
        detailsContainer.innerHTML = detailsHtml;
        hubContent.appendChild(detailsContainer);

        document.getElementById('btn-train-stats').onclick = () => {
            if(p.age >= 35) { showNotification("Impossibile", "I giocatori vecchi non si allenano più.", "warning"); return; }
            if(gameState.userTeam.coins >= trainCost) {
                showConfirm("Conferma Allenamento", `Spendere 💰${trainCost} per allenare ${p.name}?`, () => {
                    gameState.userTeam.coins -= trainCost; p.trainingBoost = (p.trainingBoost || 0) + 1;
                    saveGame(); updateDashboardHeader(); showNotification("Allenato!", `${p.name} è migliorato!`, "success");
                    renderHubPlayerDetail(p);
                });
            } else { showNotification('Fondi Insufficienti', 'Non hai abbastanza monete.', 'error'); }
        };

        document.getElementById('btn-train-role').onclick = () => {
            if(p.position === 'POR') { showNotification("Impossibile", "I portieri non imparano altri ruoli.", "warning"); return; }
            if(gameState.userTeam.coins >= roleTrainCost) {
                showConfirm("Corso Tattico", `Spendere 💰${roleTrainCost} per un nuovo ruolo a ${p.name}? 30% di successo.`, () => {
                    gameState.userTeam.coins -= roleTrainCost; updateDashboardHeader();
                    if(Math.random() < 0.3) {
                        let possibleRoles = [];
                        if(p.position === 'DIF') possibleRoles = ['CEN']; if(p.position === 'CEN') possibleRoles = ['DIF', 'ATT']; if(p.position === 'ATT') possibleRoles = ['CEN'];
                        if(!p.secondaryPositions) p.secondaryPositions = [];
                        possibleRoles = possibleRoles.filter(r => !p.secondaryPositions.includes(r));
                        if(possibleRoles.length > 0) {
                            let newRole = possibleRoles[Math.floor(Math.random() * possibleRoles.length)];
                            p.secondaryPositions.push(newRole); saveGame(); showNotification("Successo!", `${p.name} è ora anche ${newRole}!`, "success");
                        } else { showNotification("Nessun Ruolo", `${p.name} sa già fare tutto!`, "info"); }
                    } else { saveGame(); showNotification("Fallimento", `${p.name} non ha imparato nulla.`, "error"); }
                    renderHubPlayerDetail(p);
                });
            } else { showNotification('Fondi Insufficienti', 'Non hai abbastanza monete.', 'error'); }
        };

        document.getElementById('btn-sell-player').onclick = () => {
            if(gameState.userTeam.players.length <= 12) { showNotification('Rosa Corta', 'Devi avere ALMENO 12 giocatori!', 'error'); return; }
            if(p.isStarter) { showNotification('In Campo', 'Non puoi svincolare un titolare.', 'warning'); return; }
            let sellPrice = Math.floor(val * 0.9);
            showConfirm("Svincolo Giocatore", `Stai per cedere ${p.name}. Riclaverai 💰${sellPrice.toLocaleString()}.`, () => {
                gameState.userTeam.players = gameState.userTeam.players.filter(pl => pl.id !== p.id);
                gameState.userTeam.coins += sellPrice; saveGame(); updateDashboardHeader();
                showNotification('Svincolo', `Ceduto ${p.name} per 💰${sellPrice.toLocaleString()}`, 'success'); renderHubList();
            });
        };
    }

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
            let displayOverall = isOOP ? Math.floor(getEffectiveOverall(p) * 0.7) : getEffectiveOverall(p);
            let warningHTML = isOOP ? `<div class="oop-warning" title="Fuori Ruolo!"><i class="fas fa-exclamation"></i></div>` : '';
            if(p.status && p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato!"><i class="fas fa-briefcase-medical"></i></div>`;
            if(p.status && p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato!"><i class="fas fa-square"></i></div>`;

            let isSelected = selectedPlayerId === p.id ? 'selected' : '';
            const flag = p.nationality ? p.nationality.split(' ')[0] : ''; 

            pitch.innerHTML += `
                <div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};">
                    <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.7); text-shadow: 0 1px 3px #000;">${slot.role}</div>
                    <div class="player-card player-card-interactive ${isSelected}" draggable="true" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                        ${warningHTML}
                        <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${displayOverall}</div>
                        <div class="card-pos">${p.position} <span style="font-size:10px;">${flag}</span></div>
                        ${getEnergyBarHTML(p)}
                        <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
                    </div>
                </div>
            `;
        } else pitch.innerHTML += `<div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};"><div class="empty-slot" data-idx="${idx}"><i class="fas fa-plus"></i><br>${slot.role}</div></div>`;
    });

    reserves.forEach(p => {
        let isSelected = selectedPlayerId === p.id ? 'selected' : '';
        const flag = p.nationality ? p.nationality.split(' ')[0] : '';
        let warningHTML = '';
        if(p.status && p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato per ${p.status.injured} turni"><i class="fas fa-briefcase-medical"></i></div>`;
        if(p.status && p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato per ${p.status.suspended} turni"><i class="fas fa-square"></i></div>`;

        bench.innerHTML += `
            <div class="player-card player-card-interactive ${isSelected}" draggable="true" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
                ${warningHTML}
                <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${getEffectiveOverall(p)}</div>
                <div class="card-pos">${p.position} <span style="font-size:10px;">${flag}</span></div>
                ${getEnergyBarHTML(p)}
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
            if (!selectedPlayerId) { selectedPlayerId = id; renderSquad(); } 
            else { if (selectedPlayerId === id) selectedPlayerId = null; else executeSwap(selectedPlayerId, id); selectedPlayerId = null; renderSquad(); }
        };
        card.addEventListener('dragstart', (e) => { draggedId = card.getAttribute('data-id'); setTimeout(() => card.style.opacity = '0.4', 0); });
        card.addEventListener('dragend', () => { card.style.opacity = '1'; draggedId = null; });
        card.addEventListener('dragover', (e) => e.preventDefault());
        card.addEventListener('drop', (e) => { e.preventDefault(); const targetId = card.getAttribute('data-id'); if (draggedId) executeSwap(draggedId, targetId); });
        card.addEventListener('touchstart', (e) => { draggedId = card.getAttribute('data-id'); card.style.opacity = '0.6'; }, {passive: true});
        card.addEventListener('touchend', (e) => { card.style.opacity = '1'; if (!draggedId) return; const touch = e.changedTouches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY); if (targetElement) { const targetCard = targetElement.closest('.player-card-interactive'); const emptySlot = targetElement.closest('.empty-slot'); if (targetCard) { const targetId = targetCard.getAttribute('data-id'); if (targetId) executeSwap(draggedId, targetId); } else if (emptySlot) { const targetIdx = parseInt(emptySlot.getAttribute('data-idx')); executeMove(draggedId, targetIdx); } } draggedId = null; });
    });

    document.querySelectorAll('.empty-slot').forEach(slot => {
        slot.onclick = () => { const targetIdx = parseInt(slot.getAttribute('data-idx')); if (selectedPlayerId) { executeMove(selectedPlayerId, targetIdx); selectedPlayerId = null; renderSquad(); } }
        slot.addEventListener('dragover', (e) => e.preventDefault());
        slot.addEventListener('drop', (e) => { e.preventDefault(); const targetIdx = parseInt(slot.getAttribute('data-idx')); if (draggedId) executeMove(draggedId, targetIdx); });
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
        const nationFilter = document.getElementById('market-nation').value;
        const ageFilter = document.getElementById('market-age').value;

        let allPlayers = [];
        if(gameState.world) {
            for (const lg in gameState.world) {
                [1, 2, 3].forEach(div => {
                    if(gameState.world[lg][div]) {
                        gameState.world[lg][div].forEach(team => {
                            team.roster.forEach(p => { p.teamName = team.name; p.leagueName = lg; p.divLevel = div; allPlayers.push(p); });
                        });
                    }
                });
            }
        }

        let filtered = allPlayers.filter(p => {
            if(nameFilter && !p.name.toLowerCase().includes(nameFilter)) return false;
            if(posFilter && p.position !== posFilter) return false;
            if(rarityFilter && p.rarity !== rarityFilter) return false;
            if(nationFilter && p.nationKey !== nationFilter) return false;
            
            if(ageFilter) {
                let [minAge, maxAge] = ageFilter.split('-');
                if(maxAge) { if(p.age < parseInt(minAge) || p.age > parseInt(maxAge)) return false; } 
                else { if(p.age < 30) return false; }
            }
            return true;
        });

        filtered.sort((a, b) => b.overall - a.overall);
        resultsContainer.innerHTML = '';
        if(filtered.length === 0) { resultsContainer.innerHTML = '<p style="color: var(--text-hint);">Nessun talento trovato.</p>'; return; }

        filtered.slice(0, 30).forEach(p => {
            const flag = p.nationality ? p.nationality.split(' ')[0] : '';
            resultsContainer.innerHTML += `
                <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; width: 105px; padding: 8px; cursor:default; position:relative;">
                    <div style="position: absolute; top: -6px; left: -6px; background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 4px; padding: 2px 4px; font-size: 8px; color: var(--text-muted);">Div ${p.divLevel} - ${p.leagueName.substring(0,3)}</div>
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                    <div class="card-pos">${p.position} <span style="font-size:10px;">${flag} ${p.age}a</span></div>
                    <div class="card-name" title="${p.name}" style="font-size: 10px; margin-bottom: 4px;">${p.name.split(' ')[1] || p.name}</div>
                    <div style="font-size: 8px; color: var(--text-muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; border-top: 1px solid var(--border-dim); padding-top: 4px;">${p.teamName}</div>
                    <button class="glass-btn buy-btn" data-id="${p.id}" data-team="${p.teamName}" data-league="${p.leagueName}" data-div="${p.divLevel}" data-price="${p.value}" style="padding: 6px; font-size: 11px; margin-top: 8px; width: 100%; border-color: var(--gold); color: var(--gold);">💰 ${p.value.toLocaleString()}</button>
                </div>
            `;
        });

        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.getAttribute('data-id');
                const price = parseInt(e.target.getAttribute('data-price')) || 100;
                const teamName = e.target.getAttribute('data-team');
                const lg = e.target.getAttribute('data-league');
                const div = e.target.getAttribute('data-div');

                if(gameState.userTeam.coins >= price) {
                    showConfirm("Acquisto", `Vuoi acquistare il giocatore dal ${teamName} per 💰${price.toLocaleString()} monete?`, () => {
                        gameState.userTeam.coins -= price;
                        let boughtPlayer = null;
                        const cpuTeam = gameState.world[lg][div].find(t => t.name === teamName);
                        
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