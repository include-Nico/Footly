// js/engine.js
import { gameState, saveGame, getUserTeamStrength } from './state.js';
import { showNotification, showConfirm, updateDashboardHeader } from './ui.js';
import { getEffectiveOverall } from './players.js';
import { loadView, FORMATIONS } from './router.js'; 

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getStarsHTML(strength) {
    let stars = 0;
    if(strength >= 88) stars = 5; else if(strength >= 80) stars = 4; else if(strength >= 72) stars = 3; else if(strength >= 64) stars = 2; else if(strength >= 50) stars = 1;
    let html = '<div style="display:flex; gap:2px; color:var(--gold); font-size:10px; margin-top: 2px;">';
    for(let i=1; i<=5; i++) { if(i <= stars) html += '<i class="fas fa-star"></i>'; else html += '<i class="far fa-star" style="color:var(--border-dim);"></i>'; }
    html += '</div>'; return html;
}

function getEnergyBarHTML(p) {
    if(p.energy === undefined) p.energy = 100;
    let color = p.energy > 70 ? '#00f5a0' : (p.energy > 40 ? '#f0b429' : '#f05252');
    return `
    <div style="width: 100%; height: 4px; background: rgba(0,0,0,0.5); border-radius: 2px; margin-top: 4px; overflow: hidden;" title="Energia: ${p.energy}%">
        <div style="height: 100%; width: ${p.energy}%; background: ${color}; transition: width 0.3s;"></div>
    </div>`;
}

export function startMatchEngine() {
    let minute = 0; let homeScore = 0; let awayScore = 0; 
    let subsLeft = 5; let tacBonusAtt = 0; let tacBonusDef = 0;
    let selectedPlayerId = null; 
    
    let timerInterval = null;
    let pauseReasons = new Set();
    let currentSpeedIdx = 0;
    const speeds = [400, 100]; 
    const speedLabels = ["1x", "2x"];
    
    let stoppageTime = randomInt(2, 6);
    let addedTimeAnnounced = false;

    const originalFormation = gameState.userTeam.formation;
    const originalLineup = gameState.userTeam.players.map(p => ({
        id: p.id,
        isStarter: p.isStarter,
        slotIndex: p.slotIndex
    }));

    const userStr = getUserTeamStrength();
    let opponents = gameState.world[gameState.userTeam.league]?.[gameState.userTeam.division] || [];
    if (opponents.length === 0) {
        showNotification("Errore di Caricamento", "Il mondo non è caricato correttamente. Torna alla home o resetta l'account.", "error");
        return;
    }

    let oppIndex = (gameState.userTeam.matchday - 1) % opponents.length;
    let nextOpponent = opponents[oppIndex];
    let cpuDynamicStrength = nextOpponent.strength;

    gameState.userTeam.players.forEach(p => { 
        if(!p.status) p.status = { injured: 0, suspended: 0, yellowCards: 0 };
        p.matchYellows = 0; 
    });

    function updateMatchHeaderStr() {
        const str = getUserTeamStrength(); 
        document.getElementById('intro-home-str').innerHTML = `${str} ${getStarsHTML(str)}`;
    }
    
    document.getElementById('intro-matchday').textContent = gameState.userTeam.matchday;
    document.getElementById('intro-home-name').textContent = gameState.userTeam.name;
    document.getElementById('intro-away-name').textContent = nextOpponent.name;
    updateMatchHeaderStr();
    document.getElementById('intro-away-str').innerHTML = `${nextOpponent.strength} ${getStarsHTML(nextOpponent.strength)}`;
    document.getElementById('score-home-name').textContent = gameState.userTeam.name.substring(0,3);
    document.getElementById('score-away-name').textContent = nextOpponent.name.substring(0,3);

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

        if (!banner || !titleEl || !detailsEl) { if(callback) callback(); return; }

        titleEl.textContent = mainText;
        detailsEl.innerHTML = subText;
        titleEl.style.color = "white"; 
        titleEl.style.textShadow = "0 4px 20px rgba(255, 255, 255, 0.4)";

        if (type === 'goal-user') { titleEl.style.color = "var(--accent)"; titleEl.style.textShadow = "0 4px 20px rgba(0, 245, 160, 0.6)"; } 
        else if (type === 'goal-cpu') { titleEl.style.color = "var(--notif-error)"; titleEl.style.textShadow = "0 4px 20px rgba(240, 82, 82, 0.6)"; } 
        else if (type === 'yellow') { titleEl.style.color = "var(--gold)"; titleEl.style.textShadow = "0 4px 20px rgba(240, 180, 41, 0.6)"; } 
        else if (type === 'red' || type === 'injury') { titleEl.style.color = "var(--notif-error)"; titleEl.style.textShadow = "0 4px 20px rgba(240, 82, 82, 0.6)"; }
        else if (type === 'info') { titleEl.style.color = "var(--text-primary)"; }

        banner.classList.add('show');
        setTimeout(() => { banner.classList.remove('show'); if(callback) callback(); }, 3000);
    }

    let strDiffAbs = Math.abs(userStr - nextOpponent.strength);
    let totalChances = randomInt(3, 4) + Math.floor(strDiffAbs / 8); 
    if(totalChances > 8) totalChances = 8;

    let chanceMinutes = [];
    while(chanceMinutes.length < totalChances) {
        let m = randomInt(5, 88);
        if(!chanceMinutes.includes(m) && ![15, 30, 45, 60, 75, 90].includes(m)) chanceMinutes.push(m);
    }
    if(Math.random() > 0.4) chanceMinutes.push(90 + randomInt(1, stoppageTime)); 

    document.getElementById('btn-intro-sim').innerHTML = `Simula Rapida (💎 5) <i class="fas fa-bolt"></i>`;
    document.getElementById('btn-intro-sim').style.borderColor = "#00d4ff";
    document.getElementById('btn-intro-sim').style.color = "#00d4ff";

    document.getElementById('start-kickoff-btn').onclick = () => {
        document.getElementById('match-intro').style.display = 'none';
        document.getElementById('match-engine').style.display = 'flex';
        startTimer();
    };

    document.getElementById('btn-intro-squad').onclick = () => loadView('squad');
    document.getElementById('btn-intro-home').onclick = () => loadView('home');
    
    document.getElementById('btn-intro-sim').onclick = () => {
        if(gameState.userTeam.gems >= 5) {
            showConfirm("Simulazione Rapida", "Vuoi saltare la partita spendendo 💎 5 Gemme?", () => {
                gameState.userTeam.gems -= 5;
                updateDashboardHeader();
                
                gameState.userTeam.players.filter(p => p.isStarter).forEach(p => {
                    let matchLoss = p.position === 'POR' ? randomInt(2, 5) : randomInt(25, 45);
                    p.energy = Math.max(0, p.energy - matchLoss);
                    
                    // FIX: Infortuni e cartellini calcolati anche durante la simulazione rapida
                    if(Math.random() < 0.08) { 
                        if(Math.random() > 0.6) {
                            p.status.injured = Math.floor(Math.random()*2)+1;
                        } else {
                            p.matchYellows = 1; 
                            p.stats.yellowCards++; 
                            p.status.yellowCards++;
                            if (Math.random() < 0.05) { 
                                p.status.suspended = 2; 
                                p.status.yellowCards = 0; 
                                p.stats.redCards++;
                            }
                        }
                    }
                });

                const currentF = FORMATIONS[gameState.userTeam.formation];
                let wUser = Math.pow(getUserTeamStrength() + currentF.att, 2);
                let wCpu = Math.pow(nextOpponent.strength - (currentF.def * 0.5), 2);
                
                let diff = Math.abs(getUserTeamStrength() - nextOpponent.strength);
                let totalSimChances = randomInt(3, 5) + Math.floor(diff / 8);

                homeScore = 0; awayScore = 0;
                for(let i=0; i<totalSimChances; i++) {
                    if (Math.random() * (wUser + wCpu) <= wUser) { 
                        if(Math.random() > 0.4) homeScore++; 
                    } else { 
                        if(Math.random() > 0.4) awayScore++; 
                    }
                }

                for(let i=0; i<homeScore; i++) {
                    let scorer = getRandomShooter();
                    if(scorer) scorer.stats.goals++;
                }

                document.getElementById('match-intro').style.display = 'none';
                endGame();
            });
        } else { showNotification('Gemme Insufficienti', 'Servono 💎 5 Gemme per simulare.', 'error'); }
    };

    function startTimerLoop() {
        if(timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(matchTick, speeds[currentSpeedIdx]);
    }
    function pauseMatch(reason) { pauseReasons.add(reason); }
    function resumeMatch(reason) { pauseReasons.delete(reason); }
    function startTimer() { pauseReasons.clear(); startTimerLoop(); }

    document.getElementById('btn-match-speed').onclick = (e) => {
        currentSpeedIdx = (currentSpeedIdx + 1) % speeds.length;
        e.currentTarget.innerHTML = `<i class="fas fa-forward"></i> ${speedLabels[currentSpeedIdx]}`;
        if (pauseReasons.size === 0) startTimerLoop();
    };

    function matchTick() {
        if(pauseReasons.size > 0) return;
        minute++;
        
        if(minute > 90) document.getElementById('match-time').textContent = `90+${minute-90}'`;
        else document.getElementById('match-time').textContent = minute + "'";
        document.getElementById('match-progress').style.width = (Math.min(minute, 90) / 90 * 100) + "%";

        if(minute === 15 || minute === 30 || minute === 60 || minute === 75) triggerMatchEvent();
        else if(minute === 45) { 
            pauseMatch('halftime');
            addLog("L'arbitro fischia la fine del primo tempo.");
            showConfirm("Intervallo", "Le squadre rientrano negli spogliatoi. Organizza le sostituzioni.", () => { 
                resumeMatch('halftime'); document.getElementById('btn-pause-sub').click(); 
            }, "Gestione Squadra", false, true); 
        }
        else if(minute === 90 && !addedTimeAnnounced) {
            pauseMatch('stoppage');
            addedTimeAnnounced = true;
            addLog(`L'arbitro segnala ${stoppageTime} minuti di recupero.`);
            showMatchBanner('info', 'RECUPERO', `+${stoppageTime} Minuti`, () => { resumeMatch('stoppage'); });
        }
        else if(minute >= 90 + stoppageTime) { 
            pauseMatch('endgame');
            addLog("Triplice fischio! La partita è finita.");
            setTimeout(endGame, 1500); 
        }
        else { simulateMinute(); }
    }

    function applyYellowCard(p, reason) {
        p.matchYellows++; p.stats.yellowCards++; p.status.yellowCards++;

        if (p.matchYellows === 2) {
            p.status.suspended = 2; p.stats.redCards++; p.status.yellowCards = 0; 
            addLog(`🟥 DOPPIO GIALLO! <b>${p.name}</b> viene espulso!`, 'log-red');
            showMatchBanner('red', 'ESPULSO', `🟥 ${p.name}<br><span style="font-size:12px;">Doppio Giallo</span>`, () => { updateMatchHeaderStr(); renderMatchSubsList(); resumeMatch(reason); });
        } else if (p.status.yellowCards >= 2) {
            addLog(`🟨 Ammonito <b>${p.name}</b>. Era diffidato, salterà la prossima gara!`, 'log-yellow');
            showMatchBanner('yellow', 'AMMONIZIONE', `🟨 ${p.name}<br><span style="font-size:12px;color:var(--text-hint);">Diffidato: salterà la prossima gara.</span>`, () => { resumeMatch(reason); });
        } else {
            addLog(`🟨 Giallo per <b>${p.name}</b>.`, 'log-yellow');
            showMatchBanner('yellow', 'AMMONIZIONE', `🟨 ${p.name}`, () => { resumeMatch(reason); });
        }
    }

    function applyRedCard(p, reason) {
        p.status.suspended = 2; p.status.yellowCards = 0; p.stats.redCards++;
        addLog(`🟥 ROSSO DIRETTO! <b>${p.name}</b> finisce negli spogliatoi!`, 'log-red');
        showMatchBanner('red', 'ESPULSO', `🟥 ${p.name}`, () => { updateMatchHeaderStr(); renderMatchSubsList(); resumeMatch(reason); });
    }

    function simulateMinute() {
        gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0).forEach(p => {
            let fatigueChance = p.position === 'POR' ? 0.05 : 0.4;
            if(Math.random() < fatigueChance && p.energy > 0) p.energy--;
        });
        cpuDynamicStrength = Math.max(cpuDynamicStrength * 0.998, nextOpponent.strength * 0.8);

        if (chanceMinutes.includes(minute)) {
            pauseMatch('chance');
            const currentF = FORMATIONS[gameState.userTeam.formation];
            
            let wUser = Math.pow(getUserTeamStrength() + tacBonusAtt + currentF.att, 2);
            let wCpu = Math.pow(cpuDynamicStrength - (tacBonusDef * 0.5 + currentF.def * 0.5), 2);

            if(Math.random() * (wUser + wCpu) < wUser) {
                let shooter = getRandomShooter();
                let assister = null;
                if (Math.random() > 0.4) {
                    assister = getActivePlayer(['CEN', 'ATT']);
                    if (assister && shooter && assister.id === shooter.id) assister = null;
                }
                if(shooter) triggerGoalMiniGame(shooter, false, assister, 'chance');
                else { addLog("Azione sfumata per mancanza di giocatori offensivi."); resumeMatch('chance'); }
            } else {
                let oppShooter = getRandomOpponentPlayer(['ATT', 'CEN']) || getRandomOpponentPlayer();
                let oppAssister = null;
                if (Math.random() > 0.4) {
                    oppAssister = getRandomOpponentPlayer(['CEN', 'ATT']);
                    if (oppAssister && oppShooter && oppAssister.id === oppShooter.id) oppAssister = null;
                }
                triggerGoalMiniGame(oppShooter, true, oppAssister, 'chance');
            }
            return; 
        }

        if(Math.random() < 0.01) {
            let active = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0 && p.status.injured === 0);
            if(active.length > 0) {
                let p = active[Math.floor(Math.random() * active.length)];
                pauseMatch('foul');
                if(Math.random() > 0.85) { 
                    p.status.injured = Math.floor(Math.random()*2)+1; 
                    addLog(`🤕 Brutto contrasto! <b>${p.name}</b> è infortunato!`, 'log-injury'); 
                    showMatchBanner('injury', 'INFORTUNIO', `🤕 ${p.name} deve uscire!`, () => { renderMatchSubsList(); resumeMatch('foul'); });
                } else { applyYellowCard(p, 'foul'); }
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
        pauseMatch('event');
        const modal = document.getElementById('event-modal');
        const titleEl = document.getElementById('event-title');
        const descEl = document.getElementById('event-desc');
        const optionsEl = document.getElementById('event-options');
        optionsEl.innerHTML = '';
        
        let pOff = getActivePlayer(['ATT', 'CEN']) || getActivePlayer();
        let pDef = getActivePlayer(['DIF', 'CEN']) || getActivePlayer();
        
        const currentF = FORMATIONS[gameState.userTeam.formation];
        let wUser = Math.pow(getUserTeamStrength() + tacBonusAtt + currentF.att, 2);
        let wCpu = Math.pow(cpuDynamicStrength - (tacBonusDef * 0.5 + currentF.def * 0.5), 2);
        let userProb = wUser / (wUser + wCpu);
        
        let isUserEvent = Math.random() < userProb;
        let isPenalty = Math.random() < 0.2; 
        
        if (isPenalty) {
            titleEl.textContent = "Fallo in Area!"; titleEl.style.color = "var(--gold)";
            if(isUserEvent) {
                descEl.innerHTML = `L'arbitro indica il dischetto a tuo favore!`;
                addEventButton(`Calcia il Rigore`, () => { modal.classList.remove('active'); triggerPenalty(true, 'event'); });
            } else {
                descEl.innerHTML = `Intervento scomposto in area. Rigore per il ${nextOpponent.name}!`;
                addEventButton(`Vai in Porta`, () => { modal.classList.remove('active'); triggerPenalty(false, 'event'); });
            }
        } else {
            if (isUserEvent) {
                titleEl.textContent = "Azione Pericolosa!"; titleEl.style.color = "var(--accent)";
                let offVerbs = ["sale prepotentemente sulla fascia", "trova un varco centrale", "avanza palla al piede", "supera un avversario con una finta"];
                let offVerb = offVerbs[Math.floor(Math.random() * offVerbs.length)];
                descEl.innerHTML = `<b>${pOff.name}</b> ${offVerb}. La difesa è scoperta. Cosa gli diciamo di fare?`;
                
                let companions = getMultipleActivePlayers(2);
                companions.forEach(comp => {
                    if(comp.id === pOff.id) return;
                    let successChance = (getEffectiveOverall(comp) / 100) * 0.8;
                    addEventButton(`Passa la palla a ${comp.name} (${comp.position})`, () => {
                        modal.classList.remove('active');
                        if(Math.random() < successChance) { addLog(`Passaggio illuminante per ${comp.name}!`); triggerGoalMiniGame(comp, false, pOff, 'event'); }
                        else { addLog(`Passaggio intercettato per ${comp.name}. Palla persa.`); resumeMatch('event'); }
                    });
                });
                
                addEventButton(`Cerca la conclusione personale`, () => {
                    modal.classList.remove('active');
                    let successChance = (getEffectiveOverall(pOff) / 100) * 0.7; 
                    if(Math.random() < successChance) { addLog(`${pOff.name} si libera lo specchio della porta!`); triggerGoalMiniGame(pOff, false, null, 'event'); }
                    else { addLog(`${pOff.name} viene murato al momento del tiro.`); resumeMatch('event'); }
                });

            } else {
                titleEl.textContent = "Contropiede Avversario!"; titleEl.style.color = "var(--notif-warning)";
                descEl.innerHTML = `Lancio lungo improvviso! Gli avversari ripartono veloci. <b>${pDef.name}</b> è l'ultimo uomo rimasto in difesa.`;
                
                addEventButton(`Fallo Tattico (Rischio Cartellino)`, () => {
                    modal.classList.remove('active');
                    if(Math.random() < 0.3) { applyRedCard(pDef, 'event'); } 
                    else { applyYellowCard(pDef, 'event'); }
                });
                
                addEventButton(`Difendi temporeggiando (Rischio Gol)`, () => {
                    modal.classList.remove('active');
                    let successChance = (getEffectiveOverall(pDef) / 100) * 0.85;
                    if(Math.random() < successChance) { addLog(`Chiusura difensiva magistrale di <b>${pDef.name}</b>! Pericolo scampato.`); resumeMatch('event'); } 
                    else { 
                        addLog(`<b>${pDef.name}</b> viene saltato di netto! L'attaccante si invola.`); 
                        let oppShooter = getRandomOpponentPlayer(['ATT', 'CEN']) || getRandomOpponentPlayer();
                        triggerGoalMiniGame(oppShooter, true, null, 'event'); 
                    }
                });
            }
        }

        modal.classList.add('active');

        function addEventButton(text, callback) {
            let btn = document.createElement('button');
            btn.className = 'glass-btn'; btn.textContent = text; btn.style.textAlign = "left";
            btn.onclick = callback;
            optionsEl.appendChild(btn);
        }
    }

    function triggerPenalty(isUserShooter, reason = 'chance') {
        const modal = document.getElementById('goal-modal');
        let userShooter = isUserShooter ? (getRandomShooter() || getActivePlayer()) : null;
        let oppShooter = getRandomOpponentPlayer(['ATT', 'CEN']) || getRandomOpponentPlayer();
        let shooterName = isUserShooter ? (userShooter?.name || "Tuo Giocatore") : oppShooter.name;
        
        let userStr = getUserTeamStrength();
        let cpuStr = nextOpponent.strength;
        let baseRatio = userStr / (userStr + cpuStr);
        let winningCount = 3;

        document.getElementById('goal-modal-title').textContent = isUserShooter ? "RIGORE A FAVORE!" : "RIGORE CONTRO!";
        document.getElementById('goal-modal-title').style.color = isUserShooter ? "var(--accent)" : "var(--notif-error)";
        document.getElementById('shooter-name').textContent = isUserShooter ? `${shooterName} sul dischetto.` : "Tuffati per parare!";

        if (isUserShooter) {
            let finalProb = Math.max(0.3, Math.min(0.9, baseRatio + 0.2)); 
            winningCount = Math.round(finalProb * 6);
            if(winningCount < 2) winningCount = 2; 
            if(winningCount > 5) winningCount = 5;
            document.getElementById('goal-helper-text').textContent = `Scegli dove tirare! Hai ${winningCount} zone vincenti su 6!`;
        } else {
            let finalProb = Math.max(0.1, Math.min(0.7, baseRatio - 0.1)); 
            winningCount = Math.round(finalProb * 6);
            if(winningCount < 1) winningCount = 1;
            if(winningCount > 4) winningCount = 4;
            document.getElementById('goal-helper-text').textContent = `Indovina l'angolo! Hai ${winningCount} zone su 6 per parare!`;
        }

        let allZones = [0, 1, 2, 3, 4, 5];
        allZones.sort(() => Math.random() - 0.5);
        let winningZones = allZones.slice(0, winningCount);

        modal.classList.add('active');
        let isShotTaken = false;
        
        let shotTimer = setTimeout(() => {
            if(!isShotTaken) {
                if(isUserShooter) {
                    addLog(`❌ Tempo scaduto! ${shooterName} scivola sul dischetto.`);
                    modal.classList.remove('active'); resumeMatch(reason);
                } else { 
                    awayScore++; document.getElementById('score-away').textContent = awayScore; 
                    addLog(`⚽ Gol di ${shooterName} su rigore. Sei rimasto immobile.`, 'log-cpu-goal'); 
                    modal.classList.remove('active');
                    showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}`, () => { resumeMatch(reason); });
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
                
                let isWin = winningZones.includes(idx);
                
                if(isUserShooter) {
                    if(!isWin) { 
                        this.classList.add('goal-fail'); addLog(`❌ Rigore PARATO! Il portiere intuisce l'angolo.`, 'log-red'); 
                        setTimeout(() => { this.classList.remove('goal-fail'); modal.classList.remove('active'); resumeMatch(reason); }, 1200);
                    } else { 
                        this.classList.add('goal-success'); homeScore++; document.getElementById('score-home').textContent = homeScore; 
                        if(userShooter) userShooter.stats.goals++;
                        addLog(`⚽ <b>GOOOAAALLLL!</b> Rigore perfetto di ${shooterName}!`, 'log-goal'); 
                        setTimeout(() => { 
                            this.classList.remove('goal-success'); modal.classList.remove('active'); 
                            showMatchBanner('goal-user', 'GOOOOAL!', `⚽ ${shooterName}`, () => { resumeMatch(reason); });
                        }, 1200);
                    }
                } else {
                    if(isWin) { 
                        this.classList.add('goal-success'); addLog(`🧤 MIRACOLO! Hai parato il rigore intuendo l'angolo giusto!`, 'log-goal'); 
                        setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); resumeMatch(reason); }, 1200);
                    } else { 
                        this.classList.add('goal-fail'); awayScore++; document.getElementById('score-away').textContent = awayScore; 
                        addLog(`⚽ Gol di ${shooterName}. Portiere spiazzato.`, 'log-cpu-goal'); 
                        setTimeout(() => { 
                            this.classList.remove('goal-fail'); modal.classList.remove('active'); 
                            showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}`, () => { resumeMatch(reason); });
                        }, 1200);
                    }
                }
            };
        });
    }

    function triggerGoalMiniGame(shooterPlayer, isCPU, assisterPlayer = null, reason = 'chance') {
        const modal = document.getElementById('goal-modal');
        const titleEl = document.getElementById('goal-modal-title');
        const descEl = document.getElementById('shooter-name');
        const helpEl = document.getElementById('goal-helper-text');
        
        let shooterName = isCPU ? shooterPlayer.name : shooterPlayer.name;
        
        let userStr = getUserTeamStrength();
        let cpuStr = nextOpponent.strength;
        let baseRatio = userStr / (userStr + cpuStr);
        let winningCount = 3;

        if (isCPU) {
            titleEl.textContent = "DIFENDI LA PORTA!"; titleEl.style.color = "var(--notif-error)";
            descEl.textContent = `Tiro pericoloso di ${shooterName}!`; 
            
            let userGK = getActivePlayer(['POR']); 
            let gkBonus = userGK ? (getEffectiveOverall(userGK) - cpuStr) / 200 : 0; 
            let finalProb = Math.max(0.15, Math.min(0.85, baseRatio + gkBonus));
            
            winningCount = Math.round(finalProb * 6);
            if(winningCount < 1) winningCount = 1;
            if(winningCount > 5) winningCount = 5;
            helpEl.textContent = `Tuffati! Hai ${winningCount} zone su 6 di parare!`;
        } else {
            titleEl.textContent = "OCCASIONE GOL!"; titleEl.style.color = "var(--accent)";
            descEl.textContent = `${shooterName} davanti alla porta!`; 
            
            let attBonus = (getEffectiveOverall(shooterPlayer) - cpuStr) / 200;
            let finalProb = Math.max(0.15, Math.min(0.85, baseRatio + attBonus));
            
            winningCount = Math.round(finalProb * 6);
            if(winningCount < 1) winningCount = 1;
            if(winningCount > 5) winningCount = 5;
            helpEl.textContent = `Scegli dove piazzarla! ${winningCount} zone su 6 sono GOL!`;
        }

        let allZones = [0, 1, 2, 3, 4, 5];
        allZones.sort(() => Math.random() - 0.5);
        let winningZones = allZones.slice(0, winningCount);

        modal.classList.add('active');
        let isResolved = false;

        let shotTimer = setTimeout(() => {
            if(!isResolved) {
                if(isCPU) { 
                    awayScore++; document.getElementById('score-away').textContent = awayScore; 
                    addLog(`⚽ Gol di ${shooterName}! Il portiere è rimasto immobile.`, 'log-cpu-goal'); 
                    modal.classList.remove('active');
                    let astText = assisterPlayer ? `<br><span style="font-size:12px; color:white;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
                    showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}${astText}`, () => { resumeMatch(reason); });
                } 
                else { addLog(`❌ Tempo scaduto! ${shooterName} incespica sul pallone.`); modal.classList.remove('active'); resumeMatch(reason); }
            }
        }, 4000);

        const oldGrid = document.querySelector('.goal-grid');
        const newGrid = oldGrid.cloneNode(true);
        oldGrid.replaceWith(newGrid);

        newGrid.querySelectorAll('.goal-section').forEach((sec, idx) => {
            sec.onclick = function() {
                if(isResolved) return;
                isResolved = true; clearTimeout(shotTimer);
                
                let isWin = winningZones.includes(idx);

                if (isCPU) {
                    if(isWin) {
                        this.classList.add('goal-success'); addLog(`🧤 MIRACOLO! Tiro parato incredibilmente!`, 'log-goal');
                        setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); resumeMatch(reason); }, 1200);
                    } else {
                        this.classList.add('goal-fail'); awayScore++; document.getElementById('score-away').textContent = awayScore; 
                        addLog(`⚽ Gol di ${shooterName}. Tuffo dalla parte sbagliata.`, 'log-cpu-goal'); 
                        setTimeout(() => { 
                            this.classList.remove('goal-fail'); modal.classList.remove('active'); 
                            let astText = assisterPlayer ? `<br><span style="font-size:12px; color:white;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
                            showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}${astText}`, () => { resumeMatch(reason); });
                        }, 1200);
                    }
                } else {
                    if(isWin) {
                        this.classList.add('goal-success'); homeScore++; document.getElementById('score-home').textContent = homeScore;
                        shooterPlayer.stats.goals++;
                        if(assisterPlayer) assisterPlayer.stats.assists++;
                        addLog(`⚽ <b>GOOOAAALLLL!</b> Rete implacabile di <b>${shooterPlayer.name}</b>!`, 'log-goal');
                        
                        setTimeout(() => { 
                            this.classList.remove('goal-success'); modal.classList.remove('active'); 
                            let astText = assisterPlayer ? `<br><span style="font-size:12px; color:white;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
                            showMatchBanner('goal-user', 'GOOOOAL!', `⚽ ${shooterPlayer.name}${astText}`, () => { resumeMatch(reason); });
                        }, 1200);
                    } else {
                        this.classList.add('goal-fail'); addLog(`❌ Parata del portiere avversario su tiro di ${shooterPlayer.name}.`);
                        setTimeout(() => { this.classList.remove('goal-fail'); modal.classList.remove('active'); resumeMatch(reason); }, 1200);
                    }
                }
            };
        });
    }

    document.getElementById('btn-pause-sub').onclick = () => {
        pauseMatch('subs');
        const modal = document.getElementById('subs-modal');
        const matchFormSelect = document.getElementById('match-formation-select');
        
        if (matchFormSelect) {
            matchFormSelect.value = gameState.userTeam.formation;
            matchFormSelect.onchange = (e) => {
                gameState.userTeam.formation = e.target.value;
                selectedPlayerId = null; renderMatchSubsList(); updateMatchHeaderStr(); 
                addLog(`🔄 Cambio Modulo: L'allenatore passa al ${gameState.userTeam.formation}.`);
            };
        }

        renderMatchSubsList();
        modal.classList.add('active');

        document.getElementById('close-subs-btn').onclick = () => {
            modal.classList.remove('active');
            resumeMatch('subs');
        };
    };

    function renderMatchSubsList() {
        const pitch = document.getElementById('match-pitch-players');
        const bench = document.getElementById('match-bench-players');
        document.getElementById('subs-left').textContent = subsLeft;
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
                else if (p.status.yellowCards === 1 || p.matchYellows === 1) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: var(--gold); color: #000;" title="Ammonito/Diffidato"><i class="fas fa-square"></i></div>`;

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
            if(p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato per ${p.status.injured} turni"><i class="fas fa-briefcase-medical"></i></div>`;
            if(p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato per ${p.status.suspended} turni"><i class="fas fa-square"></i></div>`;
            else if (p.status.yellowCards === 1) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: var(--gold); color: #000;" title="Diffidato"><i class="fas fa-square"></i></div>`;

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
                document.getElementById('subs-left').textContent = subsLeft;
                document.getElementById('subs-modal-left').textContent = subsLeft;
                addLog(`🔄 Sostituzione: Esce ${p1.isStarter ? p1.name : p2.name}, entra ${p1.isStarter ? p2.name : p1.name}.`);
            }
            let tempS = p1.isStarter; p1.isStarter = p2.isStarter; p2.isStarter = tempS;
            let tempIdx = p1.slotIndex; p1.slotIndex = p2.slotIndex; p2.slotIndex = tempIdx;
            
            renderMatchSubsList(); updateMatchHeaderStr();
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
            if (p.status.injured > 0 && (!p.isStarter || p.status.suspended > 0)) {
                p.status.injured--;
            }
            
            // --- FIX DIFFIDE ---
            if (p.status.suspended === 1) {
                p.status.suspended = 0; 
            } 
            else if (p.status.suspended === 2) {
                p.status.suspended = 1; 
            } 
            else if (p.status.yellowCards >= 2 && p.status.suspended === 0) {
                p.status.suspended = 1; 
                p.status.yellowCards = 0;
            }
            else if (p.status.yellowCards === 1 && p.matchYellows === 0 && p.isStarter) {
                // Sconta la diffida se gioca titolare e non prende nessun altro cartellino!
                p.status.yellowCards = 0;
            }

            if(p.isStarter && p.status.suspended === 0 && p.status.injured === 0) {
                p.stats.appearances++;
                if(awayScore === 0 && (p.position === 'POR' || p.position === 'DIF')) p.stats.cleanSheets = (p.stats.cleanSheets || 0) + 1;
                p.energy += randomInt(20, 40); 
            } else {
                p.energy += randomInt(80, 100); 
            }
            if(p.energy > 100) p.energy = 100;
        });

        gameState.userTeam.formation = originalFormation;
        gameState.userTeam.players.forEach(p => {
            let orig = originalLineup.find(o => o.id === p.id);
            if (orig) {
                p.isStarter = orig.isStarter;
                p.slotIndex = orig.slotIndex;
            }
        });

        if(gameState.userTeam.activeBoostMatches > 0) {
            gameState.userTeam.activeBoostMatches--;
        }

        gameState.userTeam.stats.played++;
        gameState.userTeam.stats.goalsFor += homeScore;
        gameState.userTeam.stats.goalsAgainst += awayScore;
        let coinsEarned = homeScore * 50; 
        
        let title = "";
        if (homeScore > awayScore) { gameState.userTeam.stats.won++; gameState.userTeam.stats.points += 3; coinsEarned += 500; title="Vittoria!"; }
        else if (homeScore === awayScore) { gameState.userTeam.stats.drawn++; gameState.userTeam.stats.points += 1; coinsEarned += 200; title="Pareggio!"; }
        else { gameState.userTeam.stats.lost++; coinsEarned += 50; title="Sconfitta!"; }

        gameState.userTeam.coins += coinsEarned;
        updateDashboardHeader();

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

        showConfirm(title, `Partita conclusa: <b>${homeScore} - ${awayScore}</b><br><br>Hai guadagnato 💰${coinsEarned}. I tuoi titolari sono affaticati, falli riposare nella prossima partita!`, () => {
            loadView('home');
        }, "Torna alla Dashboard", false, true); 
    }

    function simulateGlobalMatch(t1, t2) {
        processCpuTeam(t1); processCpuTeam(t2);
        
        let diff = Math.abs(t1.strength - t2.strength);
        let totalSimChances = randomInt(3, 5) + Math.floor(diff / 8);
        
        let w1 = Math.pow(t1.strength, 2);
        let w2 = Math.pow(t2.strength, 2);
        let g1 = 0, g2 = 0;

        for(let i=0; i<totalSimChances; i++) {
            if (Math.random() * (w1 + w2) <= w1) {
                if(Math.random() > 0.4) g1++;
            } else {
                if(Math.random() > 0.4) g2++;
            }
        }
        
        t1.played++; t1.goalsFor += g1; t1.goalsAgainst += g2;
        if(g1 > g2) { t1.won++; t1.points += 3; } else if(g1 === g2) { t1.drawn++; t1.points += 1; } else { t1.lost++; }
        
        t2.played++; t2.goalsFor += g2; t2.goalsAgainst += g1;
        if(g2 > g1) { t2.won++; t2.points += 3; } else if(g2 === g1) { t2.drawn++; t2.points += 1; } else { t2.lost++; }
    }
}