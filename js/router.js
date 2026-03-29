// js/router.js
import { gameState, resetGame, saveGame, getUserTeamStrength } from './state.js';
import { updateDashboardHeader, showNotification, showConfirm, updateNavUI } from './ui.js';
import { processEndOfSeason, generatePlayer, generateRandomNameByNation, getEffectiveOverall } from './players.js'; 
import { startMatchEngine } from './engine.js'; 

const mainContent = document.getElementById('main-content');
let selectedPlayerId = null; let draggedId = null; 

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export const FORMATIONS = {
    "2-3-1": { att: 0, def: 0, pos: [
        {role:'POR', t:'86%', l:'50%'}, 
        {role:'DIF', t:'66%', l:'30%'}, {role:'DIF', t:'66%', l:'70%'}, 
        {role:'CEN', t:'42%', l:'20%'}, {role:'CEN', t:'42%', l:'50%'}, {role:'CEN', t:'42%', l:'80%'}, 
        {role:'ATT', t:'16%', l:'50%'}
    ] },
    "3-2-1": { att: -10, def: 15, pos: [
        {role:'POR', t:'86%', l:'50%'}, 
        {role:'DIF', t:'66%', l:'20%'}, {role:'DIF', t:'66%', l:'50%'}, {role:'DIF', t:'66%', l:'80%'}, 
        {role:'CEN', t:'42%', l:'35%'}, {role:'CEN', t:'42%', l:'65%'}, 
        {role:'ATT', t:'16%', l:'50%'}
    ] },
    "2-2-2": { att: 15, def: -10, pos: [
        {role:'POR', t:'86%', l:'50%'}, 
        {role:'DIF', t:'66%', l:'30%'}, {role:'DIF', t:'66%', l:'70%'}, 
        {role:'CEN', t:'42%', l:'30%'}, {role:'CEN', t:'42%', l:'70%'}, 
        {role:'ATT', t:'16%', l:'35%'}, {role:'ATT', t:'16%', l:'65%'}
    ] },
    "1-4-1": { att: 5, def: 5, pos: [
        {role:'POR', t:'86%', l:'50%'}, 
        {role:'DIF', t:'66%', l:'50%'}, 
        {role:'CEN', t:'45%', l:'15%'}, {role:'CEN', t:'38%', l:'38%'}, {role:'CEN', t:'38%', l:'62%'}, {role:'CEN', t:'45%', l:'85%'}, 
        {role:'ATT', t:'16%', l:'50%'}
    ] }
};

export async function loadView(viewName) {
    try {
        const cacheBuster = new Date().getTime();
        const response = await fetch(`views/${viewName}.html?v=${cacheBuster}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        mainContent.innerHTML = html;

        selectedPlayerId = null;

        updateNavUI(viewName);

        if (viewName === 'home') renderHome();
        else if (viewName === 'squad') renderSquad();
        else if (viewName === 'profile') renderProfile();
        else if (viewName === 'market') renderMarket();
        else if (viewName === 'store') renderStore(); 
        else if (viewName === 'match') startMatchEngine();

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
// STORE (NEGOZIO) E PACK OPENING ANIMATION
// ==========================================
function renderStore() {
    document.querySelectorAll('.btn-buy-pack').forEach(btn => {
        btn.onclick = (e) => {
            let type = e.currentTarget.getAttribute('data-type');
            let cost = parseInt(e.currentTarget.getAttribute('data-cost'));
            if(gameState.userTeam.gems >= cost) {
                showConfirm("Acquisto", `Vuoi comprare il Pack ${type} per 💎 ${cost}?`, () => {
                    gameState.userTeam.gems -= cost;
                    updateDashboardHeader();
                    openPack(type);
                });
            } else {
                showNotification('Gemme Insufficienti', 'Gioca stagioni per guadagnare Gemme.', 'error');
            }
        };
    });
}

function openPack(type) {
    let items = [];
    
    let coins = 0;
    if(type === 'COMUNE') coins = randomInt(200, 1000);
    else if(type === 'SUPER') coins = randomInt(1000, 3000);
    else if(type === 'MEGA') coins = randomInt(2500, 5000);
    
    items.push({ type: 'coin', data: coins });
    gameState.userTeam.coins += coins;

    if(type === 'SUPER') {
        for(let i=0; i<2; i++) {
            let b = Math.random() > 0.5 ? 'healAll' : 'healPlayer';
            items.push({ type: 'bonus', data: b });
            gameState.userTeam.inventory[b]++;
        }
    } else if (type === 'MEGA') {
        items.push({ type: 'bonus', data: 'superBoosts' }); 
        gameState.userTeam.inventory['superBoosts']++;
        for(let i=0; i<3; i++) {
            let b = Math.random() > 0.5 ? 'healAll' : 'healPlayer';
            items.push({ type: 'bonus', data: b });
            gameState.userTeam.inventory[b]++;
        }
    }

    let numPlayers = type === 'MEGA' ? 4 : randomInt(3, 4);
    for(let i=0; i<numPlayers; i++) {
        let rarity = 'BRONZE';
        if(type === 'COMUNE') rarity = Math.random() > 0.8 ? 'SILVER' : 'BRONZE';
        else if(type === 'SUPER') {
            let r = Math.random();
            if(r > 0.95) rarity = 'RAREGOLD';
            else if (r > 0.6) rarity = 'GOLD';
            else if (r > 0.2) rarity = 'SILVER';
            else rarity = 'BRONZE';
        }
        else if(type === 'MEGA') {
            let r = Math.random();
            if(r > 0.95) rarity = 'LEGEND';
            else if (r > 0.70) rarity = 'EPIC';
            else if (r > 0.40) rarity = 'SUPERRARE';
            else rarity = 'RAREGOLD'; 
        }
        let pos = ['POR', 'DIF', 'CEN', 'ATT'][Math.floor(Math.random()*4)];
        let player = generatePlayer(pos, false, rarity);
        items.push({ type: 'player', data: player });
        gameState.userTeam.players.push(player);
    }

    saveGame();
    updateDashboardHeader();
    triggerPackAnimation(items);
}

function triggerPackAnimation(items) {
    let overlay = document.getElementById('dynamic-pack-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'dynamic-pack-overlay';
        overlay.className = 'modal-overlay';
        overlay.style.background = 'rgba(0,0,0,0.95)';
        overlay.style.zIndex = '9999';
        
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes popInCard {
                0% { transform: scale(0.5); opacity: 0; }
                70% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
            .pop-in-anim { animation: popInCard 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            @keyframes pulseText {
                0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; }
            }
            .pulse-text-anim { animation: pulseText 1.5s infinite; }
            @keyframes epicGlow {
                0% { box-shadow: 0 0 15px var(--rarity-epic); } 50% { box-shadow: 0 0 40px var(--rarity-epic); } 100% { box-shadow: 0 0 15px var(--rarity-epic); }
            }
            @keyframes legendGlow {
                0% { box-shadow: 0 0 20px white; } 50% { box-shadow: 0 0 50px white; } 100% { box-shadow: 0 0 20px white; }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `
        <div id="pack-click-area" style="position: absolute; inset: 0; z-index: 10; cursor: pointer;"></div>
        <div class="modal-box" style="background:transparent; border:none; box-shadow:none; text-align:center; width:100%; max-width:400px; padding:0; position: relative; z-index: 20; pointer-events: none;">
            <div id="pack-reveal-area" style="min-height: 350px; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events: none;"></div>
            <div id="pack-controls" style="margin-top:20px; display:flex; justify-content:center; pointer-events: auto;"></div>
        </div>
    `;
    
    overlay.classList.add('active');
    
    const revealArea = document.getElementById('pack-reveal-area');
    const controls = document.getElementById('pack-controls');
    const clickArea = document.getElementById('pack-click-area');
    let currentIndex = 0;
    
    function showNext() {
        if (currentIndex >= items.length) {
            revealArea.innerHTML = `<h2 class="pop-in-anim" style="color:var(--gold); font-size:36px; text-shadow: 0 0 20px var(--gold);">Pacchetto Completato!</h2>`;
            controls.innerHTML = `<button class="primary-btn" id="pack-close-btn" style="width:200px;">Torna al Negozio</button>`;
            clickArea.onclick = null; 
            document.getElementById('pack-close-btn').onclick = () => {
                overlay.classList.remove('active');
                if (gameState.currentView === 'store') loadView('store');
            };
            return;
        }
        
        let item = items[currentIndex];
        let html = '';
        
        if (item.type === 'coin') {
            html = `<div class="player-card pop-in-anim" style="width:180px; height:260px; padding:20px; border: 2px solid var(--gold); box-shadow: 0 0 30px var(--gold); display: flex; flex-direction: column; justify-content: center; align-items: center; background: var(--bg-surface);">
                        <i class="fas fa-coins" style="font-size:70px; color:var(--gold); margin-bottom:20px;"></i>
                        <div style="font-size:32px; font-weight:bold; color:var(--gold);">+${item.data}</div>
                    </div>`;
        } else if (item.type === 'bonus') {
            let icon = item.data === 'superBoosts' ? 'fa-fire' : (item.data === 'healAll' ? 'fa-heart-pulse' : 'fa-medkit');
            let name = item.data === 'superBoosts' ? 'Super Boost' : (item.data === 'healAll' ? 'Cura Squadra' : 'Kit Medico');
            let color = item.data === 'superBoosts' ? 'var(--rarity-epic)' : (item.data === 'healAll' ? 'var(--accent)' : 'var(--notif-info)');
            html = `<div class="player-card pop-in-anim" style="width:180px; height:260px; padding:20px; border: 2px solid ${color}; box-shadow: 0 0 30px ${color}; display: flex; flex-direction: column; justify-content: center; align-items: center; background: var(--bg-surface);">
                        <i class="fas ${icon}" style="font-size:70px; color:${color}; margin-bottom:20px;"></i>
                        <div style="font-size:18px; font-weight:bold; text-align:center; color:${color};">${name}</div>
                    </div>`;
        } else {
            let p = item.data;
            let glowClass = '';
            
            if(p.rarity === 'Leggenda') glowClass = 'border: 2px solid white; animation: legendGlow 2s infinite;';
            else if(p.rarity === 'Epico') glowClass = `border: 2px solid ${p.color}; animation: epicGlow 2s infinite;`;
            else glowClass = `border: 2px solid ${p.color}; box-shadow: 0 0 20px ${p.color};`;
            
            html = `<div class="player-card pop-in-anim" style="width:180px; height:260px; display:flex; flex-direction:column; justify-content:flex-start; align-items:center; padding: 20px 10px; background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-deep) 100%); ${glowClass}">
                        <div style="color: ${p.color}; font-size:56px; font-weight:bold; font-family:'Barlow Condensed',sans-serif; text-shadow: 0 0 15px ${p.color}; line-height:1;">${p.overall}</div>
                        <div style="font-size:16px; font-weight:bold; color:var(--text-muted); margin-bottom: 10px;">${p.position}</div>
                        
                        <div style="font-size:20px; font-weight:bold; text-transform:uppercase; color:var(--text-primary); text-align:center; line-height: 1.1; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name.split(' ')[1] || p.name}</div>
                        <div style="font-size:14px; color:var(--text-primary); text-align:center; margin-top: 4px;">${p.name.split(' ')[0]}</div>
                        
                        <div style="margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 6px;">
                            <div style="font-size: 24px;" title="${p.nationality}">${p.nationality.split(' ')[0]}</div>
                            <div style="font-size: 14px; color: var(--text-hint);">${p.age} Anni</div>
                        </div>
                    </div>`;
        }
        
        revealArea.innerHTML = `
            ${html}
            <div class="pulse-text-anim" style="color: var(--text-hint); font-size: 14px; margin-top: 25px;">Tocca per continuare</div>
        `;
        
        controls.innerHTML = `
            <button class="glass-btn" id="pack-skip-btn" style="border-color:var(--text-hint); color:var(--text-hint);">Salta Tutti ⏭️</button>
        `;
        document.getElementById('pack-skip-btn').onclick = (e) => { 
            e.stopPropagation(); 
            currentIndex = items.length; 
            showNext(); 
        };
        
        clickArea.onclick = () => {
            currentIndex++;
            showNext();
        };
    }
    
    revealArea.innerHTML = `<i class="fas fa-box-open pop-in-anim" style="font-size:120px; color:var(--gold); filter:drop-shadow(0 0 30px var(--gold));"></i>`;
    controls.innerHTML = `<button class="primary-btn" id="pack-open-btn" style="pointer-events: auto; position: relative; z-index: 30;">APRI PACCHETTO</button>`;
    
    document.getElementById('pack-open-btn').onclick = (e) => { 
        e.stopPropagation(); 
        showNext(); 
    };
}

// ==========================================
// HOME, CALENDARIO E FINE STAGIONE
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
    const scheduleContainer = document.getElementById('schedule-container');

    if (teamNameEl) teamNameEl.textContent = gameState.userTeam.name;
    if (divNumEl) divNumEl.textContent = gameState.userTeam.division;
    if (matchdayCounter) matchdayCounter.textContent = gameState.userTeam.matchday <= 26 ? gameState.userTeam.matchday : 26;

    const userStr = getUserTeamStrength();
    const homeRatingEl = document.getElementById('home-team-rating');
    if (homeRatingEl) homeRatingEl.innerHTML = `<span style="font-weight:bold; font-size:14px; color:var(--gold);">${userStr}</span>${getStarsHTML(userStr)}`;

    const isEndOfSeason = gameState.userTeam.matchday > 26;
    let opponents = gameState.world[gameState.userTeam.league]?.[gameState.userTeam.division] || [];

    if (scheduleContainer && opponents.length > 0) {
        scheduleContainer.innerHTML = '';
        for (let i = 1; i <= 26; i++) {
            let oppIndex = (i - 1) % opponents.length;
            let opp = opponents[oppIndex];
            let isHome = (i % 2 !== 0);
            let venueText = isHome ? "Casa" : "Trasferta";
            let venueIcon = isHome ? '<i class="fas fa-house" style="color:var(--accent); font-size:10px;"></i>' : '<i class="fas fa-bus" style="color:var(--notif-warning); font-size:10px;"></i>';
            
            let statusClass = '';
            let statusText = '';
            
            if (i < gameState.userTeam.matchday) {
                statusClass = 'opacity: 0.5; border-color: var(--border-dim);';
                statusText = 'Giocata ✅';
            } else if (i === gameState.userTeam.matchday) {
                statusClass = 'border-color: var(--accent); box-shadow: 0 0 10px rgba(0, 245, 160, 0.15);';
                statusText = 'Oggi ⚽';
            } else {
                statusClass = 'border-color: var(--border-dim);';
                statusText = 'Da giocare ⏳';
            }

            let item = document.createElement('div');
            item.className = 'glass-panel';
            item.style.cssText = `min-width: 120px; padding: 10px; flex-shrink: 0; scroll-snap-align: center; border: 1px solid transparent; text-align: center; ${statusClass}`;
            
            item.innerHTML = `
                <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 4px;">Giornata ${i}</div>
                <div style="font-weight: bold; font-size: 12px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;" title="${opp.name}">${opp.name}</div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${venueIcon} ${venueText}</div>
                <div style="display: flex; flex-direction: column; align-items: center; margin-top: 6px;">
                    <div style="font-size: 11px; font-weight: bold; color: var(--gold);">${opp.strength}</div>
                    ${getStarsHTML(opp.strength)}
                </div>
                <div style="font-size: 10px; font-weight: bold; color: ${i === gameState.userTeam.matchday ? 'var(--accent)' : 'var(--text-muted)'}; margin-top: 8px;">${statusText}</div>
            `;
            scheduleContainer.appendChild(item);
        }

        setTimeout(() => {
            const currentCard = scheduleContainer.children[Math.min(gameState.userTeam.matchday - 1, 25)];
            if (currentCard) currentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 150);
    }

    if (!isEndOfSeason && opponents.length > 0) {
        let oppIndex = (gameState.userTeam.matchday - 1) % opponents.length;
        let nextOpponent = opponents[oppIndex];
        
        const nextHomeNameEl = document.getElementById('next-home-name');
        if (nextHomeNameEl) nextHomeNameEl.textContent = gameState.userTeam.name;
        
        const nextHomeRatingEl = document.getElementById('next-home-rating');
        if (nextHomeRatingEl) nextHomeRatingEl.innerHTML = `<span style="font-weight:bold; font-size:16px; color:var(--gold);">${userStr}</span>${getStarsHTML(userStr)}`;
        
        if (cpuTeamNameEl) cpuTeamNameEl.textContent = nextOpponent.name;
        
        const cpuRatingEl = document.getElementById('cpu-team-rating');
        if (cpuRatingEl) cpuRatingEl.innerHTML = `<span style="font-weight:bold; font-size:16px; color:var(--gold);">${nextOpponent.strength}</span>${getStarsHTML(nextOpponent.strength)}`;
        
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
        
        const nextHomeNameEl = document.getElementById('next-home-name');
        if (nextHomeNameEl) nextHomeNameEl.textContent = "";
        const nextHomeRatingEl = document.getElementById('next-home-rating');
        if (nextHomeRatingEl) nextHomeRatingEl.innerHTML = "";
        
        playBtnText.textContent = "Termina Stagione";
        playBtnIcon.innerHTML = '<i class="fas fa-forward-step"></i>';
        playBtn.style.background = "var(--gold)";
        playBtn.style.color = "#000";
        playBtn.style.borderColor = "var(--gold)";
        
        playBtn.onclick = () => { showConfirm("Fine Stagione", "Calcolo premi e invecchiamento...", () => { handleEndSeason(); }, "Procedi", false, true); };
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
    
    let userStr = getUserTeamStrength();
    let opponents = gameState.world[gameState.userTeam.league]?.[gameState.userTeam.division] || [];
    let standings = [...opponents];
    standings.push({ name: gameState.userTeam.name, isUser: true, points: gameState.userTeam.stats.points });
    standings.sort((a, b) => b.points - a.points);
    
    let userRank = standings.findIndex(t => t.isUser) + 1;
    let gemsEarned = 0;
    if(userRank === 1) gemsEarned = 100;
    else if(userRank <= 5) gemsEarned = 50;
    else if(userRank <= 10) gemsEarned = 20;
    else if(userRank <= 13) gemsEarned = 10;
    else gemsEarned = 0;

    gameState.userTeam.gems += gemsEarned;

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
    
    let seasonMsg = `<b>Posizione:</b> ${userRank}°<br><b>Premio:</b> 💰 ${reward.toLocaleString()} | 💎 ${gemsEarned}<br><br><b>Sviluppo Rosa:</b> <span style="color:var(--accent);">${evolutions.slice(0,5).join(', ')}...</span>`;
    
    if(userRank === 1 && gameState.userTeam.division > 1) {
        gameState.userTeam.division--;
        seasonMsg = `🎉 <b>PROMOZIONE! Sei in Div ${gameState.userTeam.division}</b><br><br>` + seasonMsg;
    } else if (userRank === 14 && gameState.userTeam.division < 3) {
        gameState.userTeam.division++;
        seasonMsg = `⚠️ <b>RETROCESSIONE! Torni in Div ${gameState.userTeam.division}</b><br><br>` + seasonMsg;
    }

    saveGame(); updateDashboardHeader();
    showConfirm("🏆 Stagione Conclusa!", seasonMsg, () => { renderHome(); }, "Nuova Stagione", false, true);
}

// ==========================================
// GESTIONE SQUADRA E INVENTARIO
// ==========================================
function renderSquad() {
    const pitch = document.getElementById('pitch-players');
    const bench = document.getElementById('bench-players');
    const formSelect = document.getElementById('formation-select');
    const attLabel = document.getElementById('tactics-att');
    const defLabel = document.getElementById('tactics-def');
    const btnOpenHub = document.getElementById('btn-open-hub');
    const btnOpenInv = document.getElementById('btn-open-inventory');
    const btnAutoPick = document.getElementById('btn-auto-pick');
    const hubModal = document.getElementById('hub-modal');
    const closeHubBtn = document.getElementById('close-hub-btn');
    const hubContent = document.getElementById('hub-content');
    
    if(!pitch || !bench || !formSelect) return;

    if(!gameState.userTeam.formation) gameState.userTeam.formation = "2-3-1";
    formSelect.value = gameState.userTeam.formation;
    formSelect.onchange = (e) => { gameState.userTeam.formation = e.target.value; selectedPlayerId = null; saveGame(); renderSquad(); };

    if (btnAutoPick) {
        btnAutoPick.onclick = () => {
            let allPlayers = [...gameState.userTeam.players];
            allPlayers.forEach(p => { p.isStarter = false; p.slotIndex = -1; });

            const currentF = FORMATIONS[gameState.userTeam.formation];
            
            // FIX: usa getEffectiveOverall per calcolare la forza reale considerando l'energia!
            allPlayers.sort((a, b) => getEffectiveOverall(b) - getEffectiveOverall(a));

            currentF.pos.forEach((slot, idx) => {
                let bestFit = allPlayers.find(p => p.slotIndex === -1 && p.status.injured === 0 && p.status.suspended === 0 && (p.position === slot.role || (p.secondaryPositions && p.secondaryPositions.includes(slot.role))));
                if (!bestFit) bestFit = allPlayers.find(p => p.slotIndex === -1 && (p.position === slot.role || (p.secondaryPositions && p.secondaryPositions.includes(slot.role))));
                if (!bestFit) bestFit = allPlayers.find(p => p.slotIndex === -1 && p.status.injured === 0 && p.status.suspended === 0);
                if (!bestFit) bestFit = allPlayers.find(p => p.slotIndex === -1);
                
                if (bestFit) {
                    bestFit.isStarter = true;
                    bestFit.slotIndex = idx;
                }
            });

            saveGame();
            renderSquad();
            showNotification('Ottimizzazione Completata', 'I giocatori più forti e freschi sono stati schierati.', 'success');
        };
    }

    const boostInd = document.getElementById('super-boost-indicator');
    if (gameState.userTeam.activeBoostMatches > 0) {
        boostInd.style.display = 'block';
        document.getElementById('boost-matches-left').textContent = gameState.userTeam.activeBoostMatches;
    } else {
        boostInd.style.display = 'none';
    }

    btnOpenHub.onclick = () => { renderHubList(); hubModal.classList.add('active'); };
    
    if(btnOpenInv) {
        btnOpenInv.onclick = () => { renderInventory(); hubModal.classList.add('active'); };
    }

    closeHubBtn.onclick = () => { hubModal.classList.remove('active'); renderSquad(); };

    function renderInventory() {
        const titleEl = document.getElementById('hub-title');
        if(titleEl) titleEl.innerHTML = `<i class="fas fa-briefcase"></i> I Tuoi Bonus`;
        
        let inv = gameState.userTeam.inventory || { healAll: 0, healPlayer: 0, superBoosts: 0 };
        
        hubContent.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div class="glass-panel" style="padding: 15px; border-color: var(--accent);">
                    <h3 style="color: var(--accent); margin-bottom: 5px;"><i class="fas fa-heart-pulse"></i> Cura Squadra (x${inv.healAll})</h3>
                    <p style="font-size: 11px; color: var(--text-hint); margin-bottom: 10px;">Ripristina l'energia di TUTTI i giocatori al 100%.</p>
                    <button class="glass-btn" id="use-heal-all" ${inv.healAll > 0 ? '' : 'disabled'}>Usa Bonus</button>
                </div>
                <div class="glass-panel" style="padding: 15px; border-color: var(--notif-info);">
                    <h3 style="color: var(--notif-info); margin-bottom: 5px;"><i class="fas fa-medkit"></i> Kit Medico (x${inv.healPlayer})</h3>
                    <p style="font-size: 11px; color: var(--text-hint); margin-bottom: 10px;">Cura istantaneamente tutti i giocatori infortunati.</p>
                    <button class="glass-btn" id="use-heal-player" ${inv.healPlayer > 0 ? '' : 'disabled'}>Usa Bonus</button>
                </div>
                <div class="glass-panel" style="padding: 15px; border-color: var(--rarity-epic);">
                    <h3 style="color: var(--rarity-epic); margin-bottom: 5px;"><i class="fas fa-fire"></i> Super Boost (x${inv.superBoosts})</h3>
                    <p style="font-size: 11px; color: var(--text-hint); margin-bottom: 10px;">Aumenta l'Overall globale della squadra del 15% per le prossime 5 partite.</p>
                    <button class="glass-btn" id="use-super-boost" ${inv.superBoosts > 0 ? '' : 'disabled'}>Attiva Boost</button>
                </div>
            </div>
        `;

        document.getElementById('use-heal-all').onclick = () => {
            if(inv.healAll > 0) {
                inv.healAll--; gameState.userTeam.players.forEach(p => p.energy = 100);
                saveGame(); showNotification('Squadra Curata!', 'Energia squadra al 100%.', 'success'); closeHubBtn.click();
            }
        };
        document.getElementById('use-heal-player').onclick = () => {
            if(inv.healPlayer > 0) {
                let injured = gameState.userTeam.players.filter(p => p.status && p.status.injured > 0);
                if(injured.length === 0) { showNotification('Attenzione', 'Nessun giocatore infortunato.', 'info'); return; }
                inv.healPlayer--; injured.forEach(p => p.status.injured = 0);
                saveGame(); showNotification('Infortunati Curati!', 'Tornati disponibili in panchina.', 'success'); closeHubBtn.click();
            }
        };
        document.getElementById('use-super-boost').onclick = () => {
            if(inv.superBoosts > 0) {
                inv.superBoosts--; gameState.userTeam.activeBoostMatches = 5;
                saveGame(); updateDashboardHeader(); showNotification('Super Boost Attivo!', '+15% Overall per 5 partite.', 'success'); 
                closeHubBtn.click(); renderSquad();
            }
        };
    }

    function renderHubList() {
        const titleEl = document.getElementById('hub-title');
        if(titleEl) titleEl.innerHTML = `<i class="fas fa-clipboard-user"></i> Hub Squadra`;

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
            
            let disabledClass = (p.status && (p.status.suspended > 0 || p.status.injured > 0)) ? "disabled" : "";

            let warningHTML = isOOP ? `<div class="oop-warning" title="Fuori Ruolo!"><i class="fas fa-exclamation"></i></div>` : '';
            if(p.status && p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato!"><i class="fas fa-briefcase-medical"></i></div>`;
            if(p.status && p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato!"><i class="fas fa-square"></i></div>`;
            else if (p.status && p.status.yellowCards === 1) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: var(--gold); color: #000;" title="Ammonito/Diffidato"><i class="fas fa-square"></i></div>`;

            let isSelected = selectedPlayerId === p.id ? 'selected' : '';
            const flag = p.nationality ? p.nationality.split(' ')[0] : ''; 

            pitch.innerHTML += `
                <div class="pitch-slot" style="top: ${slot.t}; left: ${slot.l};">
                    <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: rgba(255,255,255,0.7); text-shadow: 0 1px 3px #000;">${slot.role}</div>
                    <div class="player-card player-card-interactive ${isSelected} ${disabledClass}" draggable="true" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
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
        
        let disabledClass = (p.status && (p.status.suspended > 0 || p.status.injured > 0)) ? "disabled" : "";

        let warningHTML = '';
        if(p.status && p.status.injured > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #f43f5e;" title="Infortunato per ${p.status.injured} turni"><i class="fas fa-briefcase-medical"></i></div>`;
        if(p.status && p.status.suspended > 0) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: #ef4444;" title="Squalificato per ${p.status.suspended} turni"><i class="fas fa-square"></i></div>`;
        else if (p.status && p.status.yellowCards === 1) warningHTML += `<div class="oop-warning" style="right: auto; left: -8px; background: var(--gold); color: #000;" title="Diffidato"><i class="fas fa-square"></i></div>`;

        bench.innerHTML += `
            <div class="player-card player-card-interactive ${isSelected} ${disabledClass}" draggable="true" data-id="${p.id}" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40;">
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
// MERCATO E PROFILO
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

    const promoInput = document.getElementById('promo-code-input');
    const promoBtn = document.getElementById('promo-code-btn');
    
    if (promoBtn && promoInput) {
        promoBtn.onclick = () => {
            const code = promoInput.value.trim();
            if (code === "160105") {
                gameState.userTeam.coins = 999999999;
                gameState.userTeam.gems = 999999999;
                saveGame();
                updateDashboardHeader();
                promoInput.value = '';
                showNotification("Trucco Attivato!", "Hai sbloccato Monete e Gemme INFINITE! 💎💰", "success");
            } else if (code !== "") {
                showNotification("Errore", "Codice non valido.", "error");
            }
        };
    }
}