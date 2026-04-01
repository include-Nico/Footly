// js/engine.js
import { gameState, saveGame, getUserTeamStrength, getGlobalTeam, SEASON_SCHEDULE, simulateCupRound, getPlayoffMatchup, simulateChampionsRound, getKitCSS } from './state.js';
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
    let minute = 0; 
    let userScore = 0; let cpuScore = 0; 
    let subsLeft = 5; let tacBonusAtt = 0; let tacBonusDef = 0;
    let selectedPlayerId = null; 
    
    let timerInterval = null;
    let pauseReasons = new Set();
    let currentSpeedIdx = 0;
    const speeds = [400, 100]; 
    const speedLabels = ["1x", "2x"];
    
    let stoppageTime = randomInt(2, 6);
    let addedTimeAnnounced = false;
    let isExtraTime = false;

    if (!document.getElementById('mobile-hover-fix')) {
        const style = document.createElement('style');
        style.id = 'mobile-hover-fix';
        style.innerHTML = `.goal-section { -webkit-tap-highlight-color: transparent !important; } @media (hover: none) { .goal-section:hover { background: transparent; } .goal-section:active { background: rgba(255,255,255,0.3); } }`;
        document.head.appendChild(style);
    }

    const originalFormation = gameState.userTeam.formation;
    const originalLineup = gameState.userTeam.players.map(p => ({ id: p.id, isStarter: p.isStarter, slotIndex: p.slotIndex }));

    const userStr = getUserTeamStrength();
    
    let currentWk = gameState.userTeam.seasonWeek || 1;
    let sched = SEASON_SCHEDULE[currentWk - 1];
    
    let isCup = sched.type === 'C';
    let isChampions = sched.type === 'CC';
    let isPlayoff = sched.type === 'P'; 

    let oppName = "";
    let isHomeMatch = true;

    if (isPlayoff) {
        document.getElementById('intro-match-type').textContent = `🔥 PLAYOFF / PLAYOUT`;
        let matchup = getPlayoffMatchup();
        if (matchup) {
            oppName = matchup.opp.name;
            isHomeMatch = matchup.isHome;
        } else { showNotification("Errore", "Non sei nei playoff.", "error"); return; }
    }
    else if (isChampions) {
        document.getElementById('intro-match-type').textContent = `🏆 ${sched.name}`;
        if(gameState.userTeam.champions && gameState.userTeam.champions.rounds[sched.round]) {
            let m = gameState.userTeam.champions.rounds[sched.round].find(x => x.home === gameState.userTeam.name || x.away === gameState.userTeam.name);
            if (m) { isHomeMatch = (m.home === gameState.userTeam.name); oppName = isHomeMatch ? m.away : m.home; } 
            else { showNotification("Errore", "Nessun avversario trovato in champions.", "error"); return; }
        }
    }
    else if (isCup) {
        document.getElementById('intro-match-type').textContent = `🏆 ${sched.name}`;
        if(gameState.userTeam.cup && gameState.userTeam.cup.rounds[sched.round]) {
            let m = gameState.userTeam.cup.rounds[sched.round].find(x => x.home === gameState.userTeam.name || x.away === gameState.userTeam.name);
            if (m) { isHomeMatch = (m.home === gameState.userTeam.name); oppName = isHomeMatch ? m.away : m.home; } 
            else { showNotification("Errore", "Nessun avversario trovato in coppa.", "error"); return; }
        }
    } else {
        document.getElementById('intro-match-type').textContent = `Giornata ${sched.day}`;
        let opponents = gameState.world[gameState.userTeam.league]?.[gameState.userTeam.division] || [];
        if (opponents.length === 0) { showNotification("Errore", "Mondo non caricato.", "error"); return; }
        let opp = opponents[(sched.day - 1) % opponents.length];
        oppName = opp.name;
        isHomeMatch = (sched.day % 2 !== 0);
    }

    let nextOpponent = getGlobalTeam(oppName);
    let cpuDynamicStrength = nextOpponent.strength;

    gameState.userTeam.players.forEach(p => { 
        if(!p.status) p.status = { injured: 0, suspended: 0, yellowCards: 0 };
        p.matchYellows = 0; 
    });

    function updateScoreUI() {
        document.getElementById(isHomeMatch ? 'score-home' : 'score-away').textContent = userScore;
        document.getElementById(isHomeMatch ? 'score-away' : 'score-home').textContent = cpuScore;
    }

    function updateMatchHeaderStr() {
        const str = getUserTeamStrength(); 
        if (isHomeMatch) { let el = document.getElementById('intro-home-str'); if(el) el.innerHTML = `${str} ${getStarsHTML(str)}`; } 
        else { let el = document.getElementById('intro-away-str'); if(el) el.innerHTML = `${str} ${getStarsHTML(str)}`; }
    }
    
    document.getElementById('intro-stadium').textContent = isHomeMatch ? "Stadio di Casa" : "Stadio in Trasferta (Ospiti)";
    
    let aggregateText = "";
    if (isCup && [3, 5, 7].includes(sched.round)) {
        let prevM = gameState.userTeam.cup.rounds[sched.round-1].find(pm => (pm.home===oppName && pm.away===gameState.userTeam.name) || (pm.home===gameState.userTeam.name && pm.away===oppName));
        if (prevM) {
            let uAgg = prevM.home === gameState.userTeam.name ? prevM.scoreHome : prevM.scoreAway;
            let cAgg = prevM.home === oppName ? prevM.scoreHome : prevM.scoreAway;
            aggregateText = `Andata: ${uAgg} - ${cAgg}`;
        }
    } else if (isChampions && [6, 8].includes(sched.round)) {
        let prevM = gameState.userTeam.champions.rounds[sched.round-1].find(pm => (pm.home===oppName && pm.away===gameState.userTeam.name) || (pm.home===gameState.userTeam.name && pm.away===oppName));
        if (prevM) {
            let uAgg = prevM.home === gameState.userTeam.name ? prevM.scoreHome : prevM.scoreAway;
            let cAgg = prevM.home === oppName ? prevM.scoreHome : prevM.scoreAway;
            aggregateText = `Andata: ${uAgg} - ${cAgg}`;
        }
    }
    if (document.getElementById('intro-aggregate')) document.getElementById('intro-aggregate').textContent = aggregateText;

    function hexToRgba(hex, alpha) {
        let r = 0, g = 0, b = 0;
        if (!hex) return `rgba(255,255,255,${alpha})`;
        if (hex.length === 4) { r = "0x" + hex[1] + hex[1]; g = "0x" + hex[2] + hex[2]; b = "0x" + hex[3] + hex[3]; } 
        else if (hex.length === 7) { r = "0x" + hex[1] + hex[2]; g = "0x" + hex[3] + hex[4]; b = "0x" + hex[5] + hex[6]; }
        return `rgba(${+r}, ${+g}, ${+b}, ${alpha})`;
    }

    function getCpuTeamStyle(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        hash = Math.abs(hash);
        const palettes = [
            {p: '#e63946', s: '#ffffff', k: 'stripes'}, {p: '#1e3a8a', s: '#ffffff', k: 'solid'},
            {p: '#000000', s: '#ffffff', k: 'stripes'}, {p: '#f59e0b', s: '#000000', k: 'halves'},
            {p: '#b91c1c', s: '#000000', k: 'stripes'}, {p: '#1d4ed8', s: '#b91c1c', k: 'halves'},
            {p: '#047857', s: '#ffffff', k: 'hoops'},   {p: '#7e22ce', s: '#ffffff', k: 'solid'},
            {p: '#f97316', s: '#1e3a8a', k: 'diagonal'},{p: '#0ea5e9', s: '#ffffff', k: 'solid'},
            {p: '#4c1d95', s: '#f59e0b', k: 'halves'},  {p: '#be123c', s: '#ffffff', k: 'stripes'},
            {p: '#059669', s: '#fcd34d', k: 'halves'},  {p: '#475569', s: '#f8fafc', k: 'solid'}
        ];
        return palettes[hash % palettes.length];
    }

    let userKitCSS = getKitCSS(gameState.userTeam.colors.primary, gameState.userTeam.colors.secondary, gameState.userTeam.kitStyle);
    let cpuStyle = getCpuTeamStyle(oppName);
    let cpuKitCSS = getKitCSS(cpuStyle.p, cpuStyle.s, cpuStyle.k);

    let userShield = `<div style="width: 44px; height: 50px; border-radius: 8px 8px 50% 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); margin: 0 auto 8px; ${userKitCSS}"></div>`;
    let cpuShield = `<div style="width: 44px; height: 50px; border-radius: 8px 8px 50% 50%; border: 2px solid rgba(255,255,255,0.7); box-shadow: 0 4px 10px rgba(0,0,0,0.5); margin: 0 auto 8px; ${cpuKitCSS}"></div>`;

    let homeColor = isHomeMatch ? gameState.userTeam.colors.primary : cpuStyle.p;
    let awayColor = isHomeMatch ? cpuStyle.p : gameState.userTeam.colors.primary;

    document.getElementById('match-intro').style.background = `linear-gradient(135deg, ${hexToRgba(homeColor, 0.15)} 0%, var(--bg-surface) 40%, var(--bg-surface) 60%, ${hexToRgba(awayColor, 0.15)} 100%)`;

    let stadiumColor = isHomeMatch ? gameState.userTeam.colors.primary : cpuStyle.p;
    if ((isCup && sched.round === 8) || (isChampions && sched.round === 9)) stadiumColor = '#f0b429'; 
    document.querySelector('.match-view').style.backgroundImage = `radial-gradient(circle at top, ${hexToRgba(stadiumColor, 0.15)} 0%, transparent 70%)`;

    if (isHomeMatch) {
        document.getElementById('intro-home-icon').innerHTML = userShield;
        document.getElementById('intro-away-icon').innerHTML = cpuShield;
        document.getElementById('intro-home-name').textContent = gameState.userTeam.name; 
        document.getElementById('intro-away-name').textContent = nextOpponent.name;
        document.getElementById('intro-away-str').innerHTML = `${nextOpponent.strength} ${getStarsHTML(nextOpponent.strength)}`;
        document.getElementById('score-home-name').textContent = gameState.userTeam.name.substring(0,3).toUpperCase(); 
        document.getElementById('score-away-name').textContent = nextOpponent.name.substring(0,3).toUpperCase();
        
        let shBg = document.getElementById('score-home-bg'); if(shBg) shBg.style.cssText = `position: absolute; inset: 0; opacity: 0.4; z-index: 0; ${userKitCSS}`;
        let saBg = document.getElementById('score-away-bg'); if(saBg) saBg.style.cssText = `position: absolute; inset: 0; opacity: 0.2; z-index: 0; ${cpuKitCSS}`;
    } else {
        document.getElementById('intro-home-icon').innerHTML = cpuShield; 
        document.getElementById('intro-away-icon').innerHTML = userShield;
        document.getElementById('intro-home-name').textContent = nextOpponent.name; 
        document.getElementById('intro-home-str').innerHTML = `${nextOpponent.strength} ${getStarsHTML(nextOpponent.strength)}`;
        document.getElementById('intro-away-name').textContent = gameState.userTeam.name;
        document.getElementById('score-home-name').textContent = nextOpponent.name.substring(0,3).toUpperCase(); 
        document.getElementById('score-away-name').textContent = gameState.userTeam.name.substring(0,3).toUpperCase();
        
        let saBg = document.getElementById('score-away-bg'); if(saBg) saBg.style.cssText = `position: absolute; inset: 0; opacity: 0.4; z-index: 0; ${userKitCSS}`;
        let shBg = document.getElementById('score-home-bg'); if(shBg) shBg.style.cssText = `position: absolute; inset: 0; opacity: 0.2; z-index: 0; ${cpuKitCSS}`;
    }

    updateMatchHeaderStr(); updateScoreUI();

    const unavailable = gameState.userTeam.players.filter(p => p.isStarter && (p.status.injured > 0 || p.status.suspended > 0));
    if(unavailable.length > 0) { showNotification("Indisponibili!", "Hai schierato titolari infortunati o squalificati!", "error"); setTimeout(() => loadView('squad'), 2000); return; }

    const logContainer = document.getElementById('match-log');
    function addLog(text, type = '') {
        const div = document.createElement('div'); div.className = `log-event ${type}`;
        let displayMin = minute > 90 && !isExtraTime ? `90+${minute-90}'` : (minute > 120 ? `120+${minute-120}'` : `${minute}'`);
        div.innerHTML = `<span style="font-weight:bold; color:var(--text-hint); width:35px;">${displayMin}</span> <span>${text}</span>`;
        logContainer.prepend(div); logContainer.scrollTop = logContainer.scrollHeight;
    }

    function showMatchBanner(type, mainText, subText, callback) {
        const banner = document.getElementById('match-banner'); const titleEl = document.getElementById('match-banner-text'); const detailsEl = document.getElementById('match-banner-details');
        if (!banner || !titleEl || !detailsEl) { if(callback) callback(); return; }
        titleEl.textContent = mainText; detailsEl.innerHTML = subText; titleEl.style.color = "white"; titleEl.style.textShadow = "0 4px 20px rgba(255, 255, 255, 0.4)";
        if (type === 'goal-user') { titleEl.style.color = "var(--accent)"; titleEl.style.textShadow = "0 4px 20px rgba(0, 245, 160, 0.6)"; } 
        else if (type === 'goal-cpu') { titleEl.style.color = "var(--notif-error)"; titleEl.style.textShadow = "0 4px 20px rgba(240, 82, 82, 0.6)"; } 
        else if (type === 'yellow') { titleEl.style.color = "var(--gold)"; titleEl.style.textShadow = "0 4px 20px rgba(240, 180, 41, 0.6)"; } 
        else if (type === 'red' || type === 'injury') { titleEl.style.color = "var(--notif-error)"; titleEl.style.textShadow = "0 4px 20px rgba(240, 82, 82, 0.6)"; }
        else if (type === 'info') { titleEl.style.color = "var(--text-primary)"; }
        banner.classList.add('show'); setTimeout(() => { banner.classList.remove('show'); if(callback) callback(); }, 3000);
    }

    // === GESTIONE AUTOMATICA RUOLI IN GARA ===
    function reassignRolesIfNeeded(outPlayerId) {
        let startersNow = gameState.userTeam.players.filter(p => p.isStarter && p.status.suspended === 0 && p.id !== outPlayerId);
        if (startersNow.length === 0) return;

        if (outPlayerId === gameState.userTeam.roles?.captain) {
            let oldest = startersNow.reduce((prev, current) => (prev.age > current.age) ? prev : current);
            if(oldest) {
                gameState.userTeam.roles.captain = oldest.id;
                addLog(`©️ La fascia di capitano passa a <b>${oldest.name}</b> (${oldest.age} anni).`);
            }
        }

        if (outPlayerId === gameState.userTeam.roles?.penalty) {
            let attackers = startersNow.filter(p => p.position === 'ATT');
            let newPen = attackers.length > 0 ? attackers.sort((a,b) => b.overall - a.overall)[0] : startersNow.sort((a,b) => b.overall - a.overall)[0];
            if(newPen) {
                gameState.userTeam.roles.penalty = newPen.id;
                addLog(`🎯 Il nuovo rigorista in campo è <b>${newPen.name}</b>.`);
            }
        }
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
                    if(Math.random() < 0.08) { 
                        if(Math.random() > 0.6) { p.status.injured = Math.floor(Math.random()*2)+1; } 
                        else {
                            p.matchYellows = 1; p.stats.yellowCards++; p.status.yellowCards++;
                            if (Math.random() < 0.05) { p.status.suspended = 2; p.status.yellowCards = 0; p.stats.redCards++; }
                        }
                    }
                });

                let wUser = Math.pow(getUserTeamStrength() + FORMATIONS[gameState.userTeam.formation].att, 2);
                let wCpu = Math.pow(nextOpponent.strength - (FORMATIONS[gameState.userTeam.formation].def * 0.5), 2);
                let diff = Math.abs(getUserTeamStrength() - nextOpponent.strength);
                let totalSimChances = randomInt(3, 5) + Math.floor(diff / 8);

                userScore = 0; cpuScore = 0;
                for(let i=0; i<totalSimChances; i++) {
                    if (Math.random() * (wUser + wCpu) <= wUser) { if(Math.random() > 0.4) userScore++; } 
                    else { if(Math.random() > 0.4) cpuScore++; }
                }

                if (checkExtraTimeOrPenalties(userScore, cpuScore)) {
                    if (Math.random() > 0.5) userScore++; else cpuScore++;
                }

                for(let i=0; i<userScore; i++) {
                    let scorer = getRandomShooter(); if(scorer) scorer.stats.goals++;
                }

                document.getElementById('match-intro').style.display = 'none';
                endMatchLogic();
            });
        } else { showNotification('Gemme Insufficienti', 'Servono 💎 5 Gemme per simulare.', 'error'); }
    };

    function startTimerLoop() { if(timerInterval) clearInterval(timerInterval); timerInterval = setInterval(matchTick, speeds[currentSpeedIdx]); }
    function pauseMatch(reason) { pauseReasons.add(reason); }
    function resumeMatch(reason) { pauseReasons.delete(reason); if (pauseReasons.size === 0) startTimerLoop(); }
    function startTimer() { pauseReasons.clear(); startTimerLoop(); }

    document.getElementById('btn-match-speed').onclick = (e) => {
        currentSpeedIdx = (currentSpeedIdx + 1) % speeds.length;
        e.currentTarget.innerHTML = `<i class="fas fa-forward"></i> ${speedLabels[currentSpeedIdx]}`;
        if (pauseReasons.size === 0) startTimerLoop();
    };

    function checkExtraTimeOrPenalties(simUser = userScore, simCpu = cpuScore) {
        if (isPlayoff) return simUser === simCpu; 
        if (isCup) {
            let isSingleLeg = [0, 1, 8].includes(sched.round);
            let isSecondLeg = [3, 5, 7].includes(sched.round);
            let userAgg = simUser; let cpuAgg = simCpu;
            if (isSecondLeg) {
                let prevM = gameState.userTeam.cup.rounds[sched.round-1].find(pm => (pm.home===oppName && pm.away===gameState.userTeam.name) || (pm.home===gameState.userTeam.name && pm.away===oppName));
                if (prevM) { userAgg += prevM.home === gameState.userTeam.name ? prevM.scoreHome : prevM.scoreAway; cpuAgg += prevM.home === oppName ? prevM.scoreHome : prevM.scoreAway; }
            }
            if ((isSingleLeg || isSecondLeg) && userAgg === cpuAgg) return true;
        } else if (isChampions) {
            if (sched.round < 5) return false; 
            let isSingleLeg = [9].includes(sched.round);
            let isSecondLeg = [6, 8].includes(sched.round);
            let userAgg = simUser; let cpuAgg = simCpu;
            if (isSecondLeg) {
                let prevM = gameState.userTeam.champions.rounds[sched.round-1].find(pm => (pm.home===oppName && pm.away===gameState.userTeam.name) || (pm.home===gameState.userTeam.name && pm.away===oppName));
                if (prevM) { userAgg += prevM.home === gameState.userTeam.name ? prevM.scoreHome : prevM.scoreAway; cpuAgg += prevM.home === oppName ? prevM.scoreHome : prevM.scoreAway; }
            }
            if ((isSingleLeg || isSecondLeg) && userAgg === cpuAgg) return true;
        }
        return false;
    }

    function matchTick() {
        if(pauseReasons.size > 0) return;
        minute++;
        
        if (!isExtraTime) {
            if(minute > 90) document.getElementById('match-time').textContent = `90+${minute-90}'`;
            else document.getElementById('match-time').textContent = minute + "'";
            document.getElementById('match-progress').style.width = (Math.min(minute, 90) / 90 * 100) + "%";
        } else {
            if(minute > 120) document.getElementById('match-time').textContent = `120+${minute-120}'`;
            else document.getElementById('match-time').textContent = minute + "'";
            document.getElementById('match-progress').style.width = (Math.min(minute, 120) / 120 * 100) + "%";
        }

        if(minute === 15 || minute === 30 || minute === 60 || minute === 75 || minute === 105 || minute === 115) triggerMatchEvent();
        else if(minute === 45) { 
            pauseMatch('halftime'); addLog("L'arbitro fischia la fine del primo tempo.");
            showConfirm("Intervallo", "Le squadre rientrano negli spogliatoi.", () => { resumeMatch('halftime'); document.getElementById('btn-pause-sub').click(); }, "Gestione Squadra", false, true); 
        }
        else if(minute === 90 && !addedTimeAnnounced && !isExtraTime) {
            pauseMatch('stoppage'); addedTimeAnnounced = true; addLog(`L'arbitro segnala ${stoppageTime} minuti di recupero.`);
            showMatchBanner('info', 'RECUPERO', `+${stoppageTime} Minuti`, () => { resumeMatch('stoppage'); });
        }
        else if(minute >= 90 + stoppageTime && !isExtraTime) { 
            if (checkExtraTimeOrPenalties()) {
                pauseMatch('extratime'); isExtraTime = true;
                showConfirm("Tempi Supplementari", "Risultato in parità! Si va ai tempi supplementari.", () => {
                    minute = 90; stoppageTime = 2; chanceMinutes.push(100, 110, 118);
                    addLog("Iniziano i Tempi Supplementari!"); resumeMatch('extratime');
                }, "Gioca Supplementari", false, true);
            } else {
                pauseMatch('endgame'); addLog("Triplice fischio! La partita è finita."); setTimeout(endMatchLogic, 1500); 
            }
        }
        else if (minute >= 120 + stoppageTime && isExtraTime) {
            if (checkExtraTimeOrPenalties()) {
                pauseMatch('penalties'); addLog("Fine dei tempi supplementari! SI VA AI RIGORI!"); setTimeout(startPenaltyShootout, 2000);
            } else {
                pauseMatch('endgame'); addLog("Triplice fischio! La partita è finita."); setTimeout(endMatchLogic, 1500); 
            }
        }
        else { simulateMinute(); }
    }

    function applyYellowCard(p, reason) {
        p.matchYellows++; p.stats.yellowCards++; p.status.yellowCards++;
        if (p.matchYellows === 2) {
            p.status.suspended = 2; p.stats.redCards++; p.status.yellowCards = 0; 
            addLog(`🟥 DOPPIO GIALLO! <b>${p.name}</b> viene espulso!`, 'log-red');
            reassignRolesIfNeeded(p.id);
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
        reassignRolesIfNeeded(p.id);
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
            let wUser = Math.pow(getUserTeamStrength() + tacBonusAtt + FORMATIONS[gameState.userTeam.formation].att, 2);
            let wCpu = Math.pow(cpuDynamicStrength - (tacBonusDef * 0.5 + FORMATIONS[gameState.userTeam.formation].def * 0.5), 2);

            if(Math.random() * (wUser + wCpu) < wUser) {
                let shooter = getRandomShooter(); let assister = null;
                if (Math.random() > 0.4) { assister = getActivePlayer(['CEN', 'ATT']); if (assister && shooter && assister.id === shooter.id) assister = null; }
                if(shooter) triggerGoalMiniGame(shooter, false, assister, 'chance'); else { addLog("Azione sfumata per mancanza di giocatori offensivi."); resumeMatch('chance'); }
            } else {
                let oppShooter = getRandomOpponentPlayer(['ATT', 'CEN']) || getRandomOpponentPlayer(); let oppAssister = null;
                if (Math.random() > 0.4) { oppAssister = getRandomOpponentPlayer(['CEN', 'ATT']); if (oppAssister && oppShooter && oppAssister.id === oppShooter.id) oppAssister = null; }
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
                    showMatchBanner('injury', 'INFORTUNIO', `🤕 ${p.name} deve uscire!`, () => { 
                        renderMatchSubsList(); 
                        resumeMatch('foul'); 
                        
                        let availableBench = gameState.userTeam.players.filter(pl => !pl.isStarter && pl.status.injured === 0 && pl.status.suspended === 0);
                        if (subsLeft > 0 && availableBench.length > 0) {
                            document.getElementById('btn-pause-sub').click();
                        }
                    });
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
            selected.push(active[idx]); active.splice(idx, 1);
        }
        return selected;
    }

    function triggerMatchEvent() {
        pauseMatch('event');
        const modal = document.getElementById('event-modal'); const titleEl = document.getElementById('event-title'); const descEl = document.getElementById('event-desc'); const optionsEl = document.getElementById('event-options');
        optionsEl.innerHTML = '';
        
        let pOff = getActivePlayer(['ATT', 'CEN']) || getActivePlayer();
        let pDef = getActivePlayer(['DIF', 'CEN']) || getActivePlayer();
        
        let wUser = Math.pow(getUserTeamStrength() + tacBonusAtt + FORMATIONS[gameState.userTeam.formation].att, 2);
        let wCpu = Math.pow(cpuDynamicStrength - (tacBonusDef * 0.5 + FORMATIONS[gameState.userTeam.formation].def * 0.5), 2);
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
                    if(Math.random() < 0.3) { applyRedCard(pDef, 'event'); } else { applyYellowCard(pDef, 'event'); }
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
            let btn = document.createElement('button'); btn.className = 'glass-btn'; btn.textContent = text; btn.style.textAlign = "left"; btn.onclick = callback; optionsEl.appendChild(btn);
        }
    }

    function triggerPenalty(isUserShooter, reason = 'chance') {
        const modal = document.getElementById('goal-modal');
        
        let penId = gameState.userTeam.roles?.penalty;
        let penPlayer = penId ? gameState.userTeam.players.find(p => p.id === penId && p.isStarter && p.status.suspended === 0 && p.status.injured === 0) : null;
        let userShooter = isUserShooter ? (penPlayer || getRandomShooter() || getActivePlayer()) : null;
        let oppShooter = getRandomOpponentPlayer(['ATT', 'CEN']) || getRandomOpponentPlayer();
        let shooterName = isUserShooter ? (userShooter?.name || "Tuo Giocatore") : oppShooter.name;
        
        let userStr = getUserTeamStrength(); let cpuStr = nextOpponent.strength; let baseRatio = userStr / (userStr + cpuStr); let winningCount = 3;

        document.getElementById('goal-modal-title').textContent = isUserShooter ? "RIGORE A FAVORE!" : "RIGORE CONTRO!";
        document.getElementById('goal-modal-title').style.color = isUserShooter ? "var(--accent)" : "var(--notif-error)";
        document.getElementById('shooter-name').textContent = isUserShooter ? `${shooterName} sul dischetto.` : "Tuffati per parare!";

        if (isUserShooter) {
            let finalProb = Math.max(0.3, Math.min(0.9, baseRatio + 0.2)); winningCount = Math.round(finalProb * 6);
            if(winningCount < 2) winningCount = 2; if(winningCount > 5) winningCount = 5;
            document.getElementById('goal-helper-text').textContent = `Scegli dove tirare! Hai ${winningCount} zone vincenti su 6!`;
        } else {
            let finalProb = Math.max(0.1, Math.min(0.7, baseRatio - 0.1)); winningCount = Math.round(finalProb * 6);
            if(winningCount < 1) winningCount = 1; if(winningCount > 4) winningCount = 4;
            document.getElementById('goal-helper-text').textContent = `Indovina l'angolo! Hai ${winningCount} zone su 6 per parare!`;
        }

        let allZones = [0, 1, 2, 3, 4, 5]; allZones.sort(() => Math.random() - 0.5); let winningZones = allZones.slice(0, winningCount);

        modal.classList.add('active'); let isShotTaken = false;
        const oldGrid = document.querySelector('.goal-grid'); const newGrid = oldGrid.cloneNode(true); oldGrid.replaceWith(newGrid);

        let shotTimer = setTimeout(() => {
            if(!isShotTaken) {
                let randomZone = Math.floor(Math.random() * 6);
                let sec = newGrid.querySelector(`.goal-section[data-zone="${randomZone}"]`);
                if(sec) { addLog("Tempo scaduto! Azione automatica!"); sec.click(); }
            }
        }, 4000);

        newGrid.querySelectorAll('.goal-section').forEach((sec, idx) => {
            sec.style.webkitTapHighlightColor = 'transparent'; 
            sec.onclick = function() {
                if(isShotTaken) return; isShotTaken = true; clearTimeout(shotTimer);
                
                let isWin = winningZones.includes(idx);
                
                if(isUserShooter) {
                    if(!isWin) { 
                        this.classList.add('goal-fail'); addLog(`❌ Rigore PARATO! Il portiere intuisce l'angolo.`, 'log-red'); 
                        setTimeout(() => { this.classList.remove('goal-fail'); modal.classList.remove('active'); resumeMatch(reason); }, 1200);
                    } else { 
                        this.classList.add('goal-success'); userScore++; updateScoreUI(); if(userShooter) userShooter.stats.goals++;
                        addLog(`⚽ <b>GOOOAAALLLL!</b> Rigore perfetto di ${shooterName}!`, 'log-goal'); 
                        setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); showMatchBanner('goal-user', 'GOOOOAL!', `⚽ ${shooterName}`, () => { resumeMatch(reason); }); }, 1200);
                    }
                } else {
                    if(isWin) { 
                        this.classList.add('goal-success'); addLog(`🧤 MIRACOLO! Hai parato il rigore intuendo l'angolo giusto!`, 'log-goal'); 
                        setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); resumeMatch(reason); }, 1200);
                    } else { 
                        this.classList.add('goal-fail'); cpuScore++; updateScoreUI(); addLog(`⚽ Gol di ${shooterName}. Portiere spiazzato.`, 'log-cpu-goal'); 
                        setTimeout(() => { this.classList.remove('goal-fail'); modal.classList.remove('active'); showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}`, () => { resumeMatch(reason); }); }, 1200);
                    }
                }
            };
        });
    }

    function triggerGoalMiniGame(shooterPlayer, isCPU, assisterPlayer = null, reason = 'chance') {
        const modal = document.getElementById('goal-modal'); const titleEl = document.getElementById('goal-modal-title'); const descEl = document.getElementById('shooter-name'); const helpEl = document.getElementById('goal-helper-text');
        let shooterName = isCPU ? shooterPlayer.name : shooterPlayer.name;
        
        let userStr = getUserTeamStrength(); let cpuStr = nextOpponent.strength; let baseRatio = userStr / (userStr + cpuStr); let winningCount = 3;

        if (isCPU) {
            titleEl.textContent = "DIFENDI LA PORTA!"; titleEl.style.color = "var(--notif-error)"; descEl.textContent = `Tiro pericoloso di ${shooterName}!`; 
            
            let userGK = getActivePlayer(['POR']); let gkBonus = userGK ? (getEffectiveOverall(userGK) - cpuStr) / 200 : 0; 
            let finalProb = Math.max(0.15, Math.min(0.85, baseRatio + gkBonus));
            winningCount = Math.round(finalProb * 6); if(winningCount < 1) winningCount = 1; if(winningCount > 5) winningCount = 5;
            helpEl.textContent = `Tuffati! Hai ${winningCount} zone su 6 di parare!`;
        } else {
            titleEl.textContent = "OCCASIONE GOL!"; titleEl.style.color = "var(--accent)"; descEl.textContent = `${shooterName} davanti alla porta!`; 
            
            let attBonus = (getEffectiveOverall(shooterPlayer) - cpuStr) / 200;
            let finalProb = Math.max(0.15, Math.min(0.85, baseRatio + attBonus));
            winningCount = Math.round(finalProb * 6); if(winningCount < 1) winningCount = 1; if(winningCount > 5) winningCount = 5;
            helpEl.textContent = `Scegli dove piazzarla! ${winningCount} zone su 6 sono GOL!`;
        }

        let allZones = [0, 1, 2, 3, 4, 5]; allZones.sort(() => Math.random() - 0.5); let winningZones = allZones.slice(0, winningCount);

        modal.classList.add('active'); let isResolved = false;
        const oldGrid = document.querySelector('.goal-grid'); const newGrid = oldGrid.cloneNode(true); oldGrid.replaceWith(newGrid);

        let shotTimer = setTimeout(() => {
            if(!isResolved) {
                let randomZone = Math.floor(Math.random() * 6);
                let sec = newGrid.querySelector(`.goal-section[data-zone="${randomZone}"]`);
                if(sec) { addLog("Tempo scaduto! Azione automatica!"); sec.click(); }
            }
        }, 4000);

        newGrid.querySelectorAll('.goal-section').forEach((sec, idx) => {
            sec.style.webkitTapHighlightColor = 'transparent'; 
            sec.onclick = function() {
                if(isResolved) return; isResolved = true; clearTimeout(shotTimer);
                let isWin = winningZones.includes(idx);

                if (isCPU) {
                    if(isWin) {
                        this.classList.add('goal-success'); addLog(`🧤 MIRACOLO! Tiro parato incredibilmente!`, 'log-goal');
                        setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); resumeMatch(reason); }, 1200);
                    } else {
                        this.classList.add('goal-fail'); cpuScore++; updateScoreUI(); addLog(`⚽ Gol di ${shooterName}. Tuffo dalla parte sbagliata.`, 'log-cpu-goal'); 
                        setTimeout(() => { this.classList.remove('goal-fail'); modal.classList.remove('active'); let astText = assisterPlayer ? `<br><span style="font-size:12px; color:white;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : ''; showMatchBanner('goal-cpu', 'GOL SUBITO', `⚽ ${shooterName}${astText}`, () => { resumeMatch(reason); }); }, 1200);
                    }
                } else {
                    if(isWin) {
                        this.classList.add('goal-success'); userScore++; updateScoreUI(); shooterPlayer.stats.goals++; if(assisterPlayer) assisterPlayer.stats.assists++;
                        addLog(`⚽ <b>GOOOAAALLLL!</b> Rete implacabile di <b>${shooterPlayer.name}</b>!`, 'log-goal');
                        setTimeout(() => { this.classList.remove('goal-success'); modal.classList.remove('active'); let astText = assisterPlayer ? `<br><span style="font-size:12px; color:white;"><i class="fas fa-shoe-prints"></i> Assist: ${assisterPlayer.name}</span>` : ''; showMatchBanner('goal-user', 'GOOOOAL!', `⚽ ${shooterPlayer.name}${astText}`, () => { resumeMatch(reason); }); }, 1200);
                    } else {
                        this.classList.add('goal-fail'); addLog(`❌ Parata del portiere avversario su tiro di ${shooterPlayer.name}.`);
                        setTimeout(() => { this.classList.remove('goal-fail'); modal.classList.remove('active'); resumeMatch(reason); }, 1200);
                    }
                }
            };
        });
    }

    function startPenaltyShootout() {
        document.getElementById('match-engine').style.display = 'none';
        document.getElementById('pk-modal').classList.add('active');
        
        let pkHomeName = isHomeMatch ? "TU" : "CPU";
        let pkAwayName = isHomeMatch ? "CPU" : "TU";
        document.getElementById('pk-home-name').textContent = pkHomeName;
        document.getElementById('pk-away-name').textContent = pkAwayName;
        
        let pkUserScore = 0; let pkCpuScore = 0;
        let pkUserShots = 0; let pkCpuShots = 0;
        let isUserTurn = isHomeMatch; 
        
        function updatePkUI() {
            let hScore = isHomeMatch ? pkUserScore : pkCpuScore;
            let aScore = isHomeMatch ? pkCpuScore : pkUserScore;
            document.getElementById('pk-score').textContent = `${hScore} - ${aScore}`;
            
            let hDots = ""; for(let i=0; i<Math.max(5, (isHomeMatch ? pkUserShots : pkCpuShots)); i++) hDots += `<div style="width:10px; height:10px; border-radius:50%; background:${i < (isHomeMatch ? pkUserScore : pkCpuScore) ? 'var(--accent)' : 'rgba(255,255,255,0.2)'};"></div>`;
            let aDots = ""; for(let i=0; i<Math.max(5, (isHomeMatch ? pkCpuShots : pkUserShots)); i++) aDots += `<div style="width:10px; height:10px; border-radius:50%; background:${i < (isHomeMatch ? pkCpuScore : pkUserScore) ? 'var(--accent)' : 'rgba(255,255,255,0.2)'};"></div>`;
            document.getElementById('pk-home-dots').innerHTML = hDots;
            document.getElementById('pk-away-dots').innerHTML = aDots;

            document.getElementById('pk-status-text').textContent = isUserTurn ? "Tocca a te! Scegli dove tirare." : "La CPU sta per tirare... Tuffati!";
        }

        updatePkUI();
        const grid = document.getElementById('pk-grid');
        let pkTimer = null;

        function checkPkEnd() {
            let shotsLeftUser = Math.max(0, 5 - pkUserShots);
            let shotsLeftCpu = Math.max(0, 5 - pkCpuShots);
            
            if (pkUserShots <= 5 && pkCpuShots <= 5) {
                if (pkUserScore > pkCpuScore + shotsLeftCpu) return true;
                if (pkCpuScore > pkUserScore + shotsLeftUser) return true;
            }
            if (pkUserShots >= 5 && pkCpuShots >= 5 && pkUserShots === pkCpuShots) {
                if (pkUserScore !== pkCpuScore) return true;
            }
            return false;
        }
        
        function handlePkTurn() {
            if (checkPkEnd()) {
                document.getElementById('pk-result-overlay').style.display = 'flex';
                document.getElementById('pk-result-title').textContent = pkUserScore > pkCpuScore ? "VITTORIA AI RIGORI!" : "SCONFITTA AI RIGORI...";
                document.getElementById('pk-result-title').style.color = pkUserScore > pkCpuScore ? "var(--accent)" : "var(--notif-error)";
                
                if (pkUserScore > pkCpuScore) userScore++; else cpuScore++;
                
                document.getElementById('pk-finish-btn').onclick = () => {
                    document.getElementById('pk-modal').classList.remove('active');
                    endMatchLogic();
                };
                return;
            }

            updatePkUI();
            
            let userStr = getUserTeamStrength();
            let cpuStr = cpuDynamicStrength;
            let baseRatio = userStr / (userStr + cpuStr);
            let winningCount = 3;
            
            if (isUserTurn) {
                let finalProb = Math.max(0.3, Math.min(0.9, baseRatio + 0.2)); 
                winningCount = Math.round(finalProb * 6);
            } else {
                let finalProb = Math.max(0.1, Math.min(0.7, baseRatio - 0.1)); 
                winningCount = Math.round(finalProb * 6);
            }
            winningCount = Math.max(1, Math.min(5, winningCount));

            let allZones = [0, 1, 2, 3, 4, 5];
            allZones.sort(() => Math.random() - 0.5);
            let winningZones = allZones.slice(0, winningCount);

            let isResolved = false;
            
            pkTimer = setTimeout(() => {
                if(!isResolved) {
                    let randomZone = Math.floor(Math.random() * 6);
                    let sec = grid.querySelector(`.goal-section[data-zone="${randomZone}"]`);
                    if(sec) sec.click();
                }
            }, 5000);

            grid.querySelectorAll('.goal-section').forEach((sec, idx) => {
                sec.className = 'goal-section'; 
                sec.style.webkitTapHighlightColor = 'transparent';
                sec.onclick = function() {
                    if(isResolved) return;
                    isResolved = true; clearTimeout(pkTimer);
                    
                    let isWin = winningZones.includes(idx);
                    if (isUserTurn) {
                        if(isWin) { this.classList.add('goal-success'); pkUserScore++; }
                        else { this.classList.add('goal-fail'); }
                        pkUserShots++;
                    } else {
                        if(isWin) { this.classList.add('goal-success'); } 
                        else { this.classList.add('goal-fail'); pkCpuScore++; } 
                        pkCpuShots++;
                    }
                    
                    setTimeout(() => {
                        isUserTurn = !isUserTurn;
                        grid.querySelectorAll('.goal-section').forEach(s => s.className = 'goal-section');
                        handlePkTurn();
                    }, 1200);
                };
            });
        }
        handlePkTurn();
    }

    document.getElementById('btn-pause-sub').onclick = () => {
        pauseMatch('subs');
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
            let injuredStarters = gameState.userTeam.players.filter(p => p.isStarter && p.status.injured > 0);
            let availableBench = gameState.userTeam.players.filter(p => !p.isStarter && p.status.injured === 0 && p.status.suspended === 0);
            
            if (injuredStarters.length > 0 && subsLeft > 0 && availableBench.length > 0) {
                showNotification("Sostituzione Obbligatoria", "Devi sostituire il giocatore infortunato prima di continuare!", "warning");
                return;
            }

            modal.classList.remove('active');
            resumeMatch('subs');
        };
    };

    function renderMatchSubsList() {
        const pitch = document.getElementById('match-pitch-players');
        const bench = document.getElementById('match-bench-players');
        
        let sLeftEl = document.getElementById('subs-left');
        let sModalLeftEl = document.getElementById('subs-modal-left');
        if(sLeftEl) sLeftEl.textContent = subsLeft;
        if(sModalLeftEl) sModalLeftEl.textContent = subsLeft;
        
        const currentF = FORMATIONS[gameState.userTeam.formation];
        let totalTacAtt = tacBonusAtt + currentF.att;
        let totalTacDef = tacBonusDef + currentF.def;
        
        let attEl = document.getElementById('match-tactics-att');
        let defEl = document.getElementById('match-tactics-def');
        if (attEl) attEl.textContent = `ATT: ${totalTacAtt > 0 ? '+' : ''}${totalTacAtt}%`;
        if (defEl) defEl.textContent = `DIF: ${totalTacDef > 0 ? '+' : ''}${totalTacDef}%`;

        pitch.innerHTML = ''; bench.innerHTML = '';
        
        let starters = gameState.userTeam.players.filter(p => p.isStarter);
        let reserves = gameState.userTeam.players.filter(p => !p.isStarter);

        currentF.pos.forEach((slot, idx) => {
            let p = starters.find(pl => pl.slotIndex === idx);
            if(p) {
                const isOOP = (p.position !== slot.role) && !(p.secondaryPositions && p.secondaryPositions.includes(slot.role));
                let displayOverall = isOOP ? Math.floor(getEffectiveOverall(p) * 0.7) : getEffectiveOverall(p);
                
                let disabledClass = (p.status && (p.status.suspended > 0 || p.status.injured > 0)) ? "disabled" : "";

                let warningHTML = isOOP ? `<div class="oop-warning" title="Fuori Ruolo!"><i class="fas fa-exclamation"></i></div>` : '';
                if(p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato!"><i class="fas fa-briefcase-medical"></i></div>`;
                if(p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Espulso!"><i class="fas fa-square"></i></div>`;
                else if (p.status && p.status.yellowCards === 1) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: var(--gold); color: #000;" title="Ammonito/Diffidato"><i class="fas fa-square"></i></div>`;

                let roleIcons = '';
                if (gameState.userTeam.roles?.captain === p.id) roleIcons += '<div style="background:var(--gold); color:#000; border-radius:50%; width:16px; height:16px; font-size:10px; font-weight:bold; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.5);" title="Capitano">C</div>';
                if (gameState.userTeam.roles?.penalty === p.id) roleIcons += '<div style="background:var(--accent); color:#000; border-radius:50%; width:16px; height:16px; font-size:10px; font-weight:bold; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.5);" title="Rigorista">R</div>';
                let rolesHtml = roleIcons ? `<div style="position: absolute; bottom: -8px; right: -8px; display:flex; gap: 2px; z-index: 10;">${roleIcons}</div>` : '';

                let isSelected = selectedPlayerId === p.id;
                let selStyle = isSelected ? `border: 2px solid var(--accent); box-shadow: 0 0 20px var(--accent); transform: scale(1.08); transition: all 0.2s;` : `border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; transition: all 0.2s;`;
                const flag = p.nationality ? p.nationality.split(' ')[0] : ''; 

                pitch.innerHTML += `
                    <div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};">
                        <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.7); text-shadow: 0 1px 3px #000;">${slot.role}</div>
                        <div class="player-card match-card-interactive ${disabledClass}" data-id="${p.id}" style="${selStyle}">
                            ${warningHTML}
                            ${rolesHtml}
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
            let isSelected = selectedPlayerId === p.id;
            let selStyle = isSelected ? `border: 2px solid var(--accent); box-shadow: 0 0 20px var(--accent); transform: scale(1.08); transition: all 0.2s;` : `border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; transition: all 0.2s;`;
            const flag = p.nationality ? p.nationality.split(' ')[0] : '';
            
            let disabledClass = (p.status && (p.status.suspended > 0 || p.status.injured > 0)) ? "disabled" : "";

            let warningHTML = '';
            if(p.status && p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato per ${p.status.injured} turni"><i class="fas fa-briefcase-medical"></i></div>`;
            if(p.status && p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato per ${p.status.suspended} turni"><i class="fas fa-square"></i></div>`;
            else if (p.status && p.status.yellowCards === 1) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: var(--gold); color: #000;" title="Diffidato"><i class="fas fa-square"></i></div>`;

            let roleIcons = '';
            if (gameState.userTeam.roles?.captain === p.id) roleIcons += '<div style="background:var(--gold); color:#000; border-radius:50%; width:16px; height:16px; font-size:10px; font-weight:bold; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.5);" title="Capitano">C</div>';
            if (gameState.userTeam.roles?.penalty === p.id) roleIcons += '<div style="background:var(--accent); color:#000; border-radius:50%; width:16px; height:16px; font-size:10px; font-weight:bold; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.5);" title="Rigorista">R</div>';
            let rolesHtml = roleIcons ? `<div style="position: absolute; bottom: -8px; right: -8px; display:flex; gap: 2px; z-index: 10;">${roleIcons}</div>` : '';

            bench.innerHTML += `
                <div class="player-card match-card-interactive ${disabledClass}" data-id="${p.id}" style="${selStyle}">
                    ${warningHTML}
                    ${rolesHtml}
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${getEffectiveOverall(p)}</div>
                    <div class="card-pos">${p.position} <span style="font-size:10px;">${flag}</span></div>
                    ${getEnergyBarHTML(p)}
                    <div class="card-name" title="${p.name}">${p.name.split(' ')[1] || p.name}</div>
                </div>
            `;
        });

        function executeMatchSwap(id1, id2) {
            if(id1 === id2) return;
            let p1 = gameState.userTeam.players.find(pl => pl.id === id1); 
            let p2 = gameState.userTeam.players.find(pl => pl.id === id2);
            
            if ((!p1.isStarter && (p1.status.injured > 0 || p1.status.suspended > 0)) ||
                (!p2.isStarter && (p2.status.injured > 0 || p2.status.suspended > 0))) {
                showNotification("Non disponibile", "Non puoi far entrare un giocatore infortunato o squalificato.", "error");
                return;
            }

            if ((p1.isStarter && p1.status.suspended > 0) || (p2.isStarter && p2.status.suspended > 0)) {
                showNotification("Azione bloccata", "Non puoi sostituire un giocatore espulso.", "error");
                return;
            }
            
            let outPlayer = null;
            if(p1.isStarter !== p2.isStarter) {
                if(subsLeft <= 0) { showNotification("Cambi Esauriti", "Hai finito le sostituzioni disponibili.", "error"); return; }
                subsLeft--;
                if(sLeftEl) sLeftEl.textContent = subsLeft;
                if(sModalLeftEl) sModalLeftEl.textContent = subsLeft;
                
                outPlayer = p1.isStarter ? p1 : p2;
                let inPlayer = p1.isStarter ? p2 : p1;
                addLog(`🔄 Sostituzione: Esce ${outPlayer.name}, entra ${inPlayer.name}.`);
            }
            
            let tempS = p1.isStarter; p1.isStarter = p2.isStarter; p2.isStarter = tempS;
            let tempIdx = p1.slotIndex; p1.slotIndex = p2.slotIndex; p2.slotIndex = tempIdx;
            
            if (outPlayer) reassignRolesIfNeeded(outPlayer.id);
            
            renderMatchSubsList(); updateMatchHeaderStr();
        }

        document.querySelectorAll('.match-card-interactive').forEach(card => {
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

    function endMatchLogic() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        document.getElementById('match-engine').style.display = 'none'; 

        if (!gameState.userTeam.matchHistory) gameState.userTeam.matchHistory = [];
        gameState.userTeam.matchHistory.push({
            week: currentWk, userScore: userScore, oppScore: cpuScore,
            oppName: oppName, isHome: isHomeMatch, isPlayoff: isPlayoff, isCup: isCup, isChampions: isChampions
        });

        gameState.userTeam.players.forEach(p => {
            if (p.status.injured > 0 && (!p.isStarter || p.status.suspended > 0)) p.status.injured--;
            if (p.status.suspended === 1) p.status.suspended = 0; 
            else if (p.status.suspended === 2) p.status.suspended = 1; 
            else if (p.status.yellowCards >= 2 && p.status.suspended === 0) { p.status.suspended = 1; p.status.yellowCards = 0; }
            else if (p.status.yellowCards === 1 && p.matchYellows === 0 && p.isStarter) p.status.yellowCards = 0;

            if(p.isStarter && p.status.suspended === 0 && p.status.injured === 0) {
                p.stats.appearances++;
                if(cpuScore === 0 && (p.position === 'POR' || p.position === 'DIF')) p.stats.cleanSheets = (p.stats.cleanSheets || 0) + 1;
                p.energy += randomInt(20, 40); 
            } else { p.energy += randomInt(80, 100); }
            if(p.energy > 100) p.energy = 100;
        });

        gameState.userTeam.formation = originalFormation;
        gameState.userTeam.players.forEach(p => {
            let orig = originalLineup.find(o => o.id === p.id);
            if (orig) { p.isStarter = orig.isStarter; p.slotIndex = orig.slotIndex; }
        });

        if(gameState.userTeam.activeBoostMatches > 0) gameState.userTeam.activeBoostMatches--;

        let coinsEarned = userScore * 50; 
        let title = "";

        if (isPlayoff) {
            gameState.userTeam.playoffWon = (userScore > cpuScore);
            title = "Playoff Conclusi!";
            coinsEarned += gameState.userTeam.playoffWon ? 1000 : 100;
        }
        else if (isChampions) {
            let m = gameState.userTeam.champions.rounds[sched.round].find(x => x.home === gameState.userTeam.name || x.away === gameState.userTeam.name);
            if (m) {
                if (isHomeMatch) { m.scoreHome = userScore; m.scoreAway = cpuScore; }
                else { m.scoreAway = userScore; m.scoreHome = cpuScore; }
                
                if (sched.round < 5) {
                    let st1 = gameState.userTeam.champions.groupStandings[m.group].find(s => s.name === m.home);
                    let st2 = gameState.userTeam.champions.groupStandings[m.group].find(s => s.name === m.away);
                    st1.gf += m.scoreHome; st1.ga += m.scoreAway; st2.gf += m.scoreAway; st2.ga += m.scoreHome;
                    if (m.scoreHome > m.scoreAway) st1.pts += 3; else if (m.scoreHome < m.scoreAway) st2.pts += 3; else { st1.pts += 1; st2.pts += 1; }
                }
            }

            simulateChampionsRound(sched.round);
            title = "Partita di Champions Conclusa!";
            if (userScore > cpuScore) {
                coinsEarned += 1000;
                if(sched.round === 9) { 
                    gameState.userTeam.gems += 100; 
                    if (!gameState.userTeam.inventory.superBoosts) gameState.userTeam.inventory.superBoosts = 0;
                    gameState.userTeam.inventory.superBoosts += 3;
                    if (!gameState.userTeam.palmares) gameState.userTeam.palmares = [];
                    gameState.userTeam.palmares.push({ year: gameState.userTeam.seasonYear, icon: '🌟', name: 'Coppa dei Campioni' });
                    showNotification("CAMPIONI D'EUROPA!", "Hai vinto la Coppa dei Campioni! +100 Gemme e 3 Super Boost!", "success", 6000); 
                }
            } else if (userScore === cpuScore) coinsEarned += 400;

            nextOpponent.roster.forEach(p => p.stats.appearances = (p.stats.appearances||0)+1);
            for(let k=0; k<cpuScore; k++) { let sc = nextOpponent.roster[Math.floor(Math.random()*6)]; if(sc) sc.stats.goals = (sc.stats.goals||0)+1; }
            if (userScore === 0) { let gk = nextOpponent.roster.find(p=>p.position==='POR'); if(gk) gk.stats.cleanSheets = (gk.stats.cleanSheets||0)+1; }
        }
        else if (isCup) {
            let m = gameState.userTeam.cup.rounds[sched.round].find(x => x.home === gameState.userTeam.name || x.away === gameState.userTeam.name);
            if (m) {
                if (isHomeMatch) { m.scoreHome = userScore; m.scoreAway = cpuScore; }
                else { m.scoreAway = userScore; m.scoreHome = cpuScore; }
            }
            simulateCupRound(sched.round);
            
            title = "Partita di Coppa Conclusa!";
            if (userScore > cpuScore) {
                coinsEarned += 800;
                if(sched.round === 8) { 
                    gameState.userTeam.gems += 50; 
                    if (!gameState.userTeam.palmares) gameState.userTeam.palmares = [];
                    gameState.userTeam.palmares.push({ year: gameState.userTeam.seasonYear, icon: '🏅', name: 'Coppa Nazionale' });
                    showNotification("CAMPIONI DI COPPA!", "Hai vinto la Coppa Nazionale! +50 Gemme!", "success", 6000); 
                }
            }
            else if (userScore === cpuScore) coinsEarned += 300;

            nextOpponent.roster.forEach(p => p.stats.appearances = (p.stats.appearances||0)+1);
            for(let k=0; k<cpuScore; k++) { let sc = nextOpponent.roster[Math.floor(Math.random()*6)]; if(sc) sc.stats.goals = (sc.stats.goals||0)+1; }
            if (userScore === 0) { let gk = nextOpponent.roster.find(p=>p.position==='POR'); if(gk) gk.stats.cleanSheets = (gk.stats.cleanSheets||0)+1; }

        } else {
            gameState.userTeam.stats.played++;
            gameState.userTeam.stats.goalsFor += userScore;
            gameState.userTeam.stats.goalsAgainst += cpuScore;
            
            if (userScore > cpuScore) { gameState.userTeam.stats.won++; gameState.userTeam.stats.points += 3; coinsEarned += 500; title="Vittoria!"; }
            else if (userScore === cpuScore) { gameState.userTeam.stats.drawn++; gameState.userTeam.stats.points += 1; coinsEarned += 200; title="Pareggio!"; }
            else { gameState.userTeam.stats.lost++; coinsEarned += 50; title="Sconfitta!"; }

            processCpuTeam(nextOpponent);
            nextOpponent.played++; nextOpponent.goalsFor += cpuScore; nextOpponent.goalsAgainst += userScore;
            if (cpuScore > userScore) { nextOpponent.won++; nextOpponent.points += 3; }
            else if (cpuScore === userScore) { nextOpponent.drawn++; nextOpponent.points += 1; }
            else { nextOpponent.lost++; }
            
            nextOpponent.roster.forEach(p => p.stats.appearances = (p.stats.appearances||0)+1);
            for(let k=0; k<cpuScore; k++) { let sc = nextOpponent.roster[Math.floor(Math.random()*6)]; if(sc) sc.stats.goals = (sc.stats.goals||0)+1; }
            if (userScore === 0) { let gk = nextOpponent.roster.find(p=>p.position==='POR'); if(gk) gk.stats.cleanSheets = (gk.stats.cleanSheets||0)+1; }

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
        }

        let marketUpdated = generateTransferOffers();

        gameState.userTeam.coins += coinsEarned;
        gameState.userTeam.seasonWeek++;
        saveGame();
        updateDashboardHeader();
        checkMarketNotifications();

        let extraMsg = marketUpdated ? "<br><br><b>Novità sul Mercato!</b> Hai ricevuto un'offerta." : "";

        showConfirm(title, `Partita conclusa: <b>${userScore} - ${cpuScore}</b><br><br>Hai guadagnato 💰${coinsEarned}.${extraMsg}`, () => {
            loadView('home');
        }, "Torna alla Dashboard", false, true); 
    }

    function simulateGlobalMatch(t1, t2) {
        processCpuTeam(t1); processCpuTeam(t2);
        let diff = Math.abs(t1.strength - t2.strength);
        let totalSimChances = randomInt(3, 5) + Math.floor(diff / 8);
        let w1 = Math.pow(t1.strength, 2); let w2 = Math.pow(t2.strength, 2);
        let g1 = 0, g2 = 0;
        for(let i=0; i<totalSimChances; i++) {
            if (Math.random() * (w1 + w2) <= w1) { if(Math.random() > 0.4) g1++; }
            else { if(Math.random() > 0.4) g2++; }
        }
        t1.played++; t1.goalsFor += g1; t1.goalsAgainst += g2;
        if(g1 > g2) { t1.won++; t1.points += 3; } else if(g1 === g2) { t1.drawn++; t1.points += 1; } else { t1.lost++; }
        t2.played++; t2.goalsFor += g2; t2.goalsAgainst += g1;
        if(g2 > g1) { t2.won++; t2.points += 3; } else if(g2 === g1) { t2.drawn++; t2.points += 1; } else { t2.lost++; }

        t1.roster.forEach(p => { p.stats.appearances = (p.stats.appearances||0)+1; });
        t2.roster.forEach(p => { p.stats.appearances = (p.stats.appearances||0)+1; });
        for(let i=0; i<g1; i++) { let p = t1.roster[Math.floor(Math.random()*6)]; if(p) p.stats.goals = (p.stats.goals || 0)+1; }
        for(let i=0; i<g2; i++) { let p = t2.roster[Math.floor(Math.random()*6)]; if(p) p.stats.goals = (p.stats.goals || 0)+1; }
        if(g2===0) { let gk = t1.roster.find(p=>p.position==='POR'); if(gk) gk.stats.cleanSheets=(gk.stats.cleanSheets||0)+1; }
        if(g1===0) { let gk = t2.roster.find(p=>p.position==='POR'); if(gk) gk.stats.cleanSheets=(gk.stats.cleanSheets||0)+1; }
    }
}