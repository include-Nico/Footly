// js/engine.js
import { gameState, saveGame, getUserTeamStrength } from './state.js';
import { showNotification, showConfirm } from './ui.js';
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
    let minute = 0; let homeScore = 0; let awayScore = 0; let timerInterval;
    let isPaused = false; let subsLeft = 5; let tacBonusAtt = 0; let tacBonusDef = 0; let redCards = 0;
    let selectedPlayerId = null; let draggedId = null;

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
    
    const logContainer = document.getElementById('match-log');
    function addLog(text, type = '') {
        const div = document.createElement('div'); div.className = `log-event ${type}`;
        div.innerHTML = `<span style="font-weight:bold; color:var(--text-hint); width:30px;">${minute}'</span> <span>${text}</span>`;
        logContainer.prepend(div);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    // ─── BANNER UNIVERSALE EVENTI ───
    function showMatchBanner(type, mainText, subText, callback) {
        const banner = document.getElementById('match-banner');
        const titleEl = document.getElementById('match-banner-text');
        const detailsEl = document.getElementById('match-banner-details');

        if (!banner || !detailsEl) { if(callback) callback(); return; }

        titleEl.textContent = mainText;
        detailsEl.innerHTML = subText;
        titleEl.style.color = "white"; // Reset

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
        }

        banner.classList.add('show');
        setTimeout(() => { 
            banner.classList.remove('show'); 
            if(callback) callback(); // Fa ripartire il tempo!
        }, 3000);
    }

    let totalChances = randomInt(3, 5); 
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

            if(minute === 15 || minute === 30 || minute === 60 || minute === 75) triggerMatchEvent();
            else if(minute === 45) { 
                isPaused = true; 
                addLog("L'arbitro fischia la fine del primo tempo.");
                showConfirm("Intervallo", "Le squadre rientrano negli spogliatoi. Organizza le sostituzioni.", () => { 
                    document.getElementById('btn-pause-sub').click(); 
                }, "Gestione Squadra", false, true); 
            }
            else if(minute >= 90) { clearInterval(timerInterval); isPaused = true; endGame(); return; }
            else { simulateMinute(); }
        }, 150); 
    }

    function simulateMinute() {
        gameState.userTeam.players.filter(p => p.isStarter).forEach(p => {
            let fatigueChance = p.position === 'POR' ? 0.05 : 0.4;
            if(Math.random() < fatigueChance && p.energy > 0) p.energy--;
        });
        cpuDynamicStrength = Math.max(cpuDynamicStrength * 0.998, nextOpponent.strength * 0.8);

        if (chanceMinutes.includes(minute)) {
            isPaused = true;
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
        }

        // EVENTI CASUALI CARTELLINI/INFORTUNI
        if(Math.random() < 0.005) {
            let active = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0 && p.status.injured === 0);
            if(active.length > 0) {
                let p = active[Math.floor(Math.random() * active.length)];
                let rand = Math.random();
                isPaused = true; // Ferma il tempo per mostrare il banner
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
            descEl.innerHTML = `Lancio lungo improvviso! Gli avversari ripartono veloci. <b>${pDef.name}</b> è l'ultimo uomo in difesa.`;
            
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
        
        let shooterName = shooterPlayer ? shooterPlayer.name : "Giocatore";

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
                    let astText = assisterPlayer ? `<br><span style="font-size:12px; color:var(--text-hint); font-weight:normal;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
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
                                let astText = assisterPlayer ? `<br><span style="font-size:12px; color:var(--text-hint); font-weight:normal;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
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
                            let astText = assisterPlayer ? `<br><span style="font-size:12px; color:var(--text-hint); font-weight:normal;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : '';
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

        showConfirm(title, `Partita conclusa: <b>${homeScore} - ${awayScore}</b><br><br>Hai guadagnato 💰${coinsEarned}. I tuoi titolari sono affaticati, falli riposare nella prossima partita!`, () => {
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