// js/state.js
import { getEffectiveOverall } from './players.js'; 

export const SEASON_SCHEDULE = [
    {type:'L', day:1}, {type:'L', day:2}, {type:'L', day:3}, 
    {type:'C', round:0, name:'Preliminari Coppa'},
    {type:'L', day:4}, {type:'L', day:5}, 
    {type:'C', round:1, name:'Sedicesimi Coppa'},
    {type:'L', day:6}, {type:'L', day:7}, 
    {type:'C', round:2, name:'Ottavi (Andata)'},
    {type:'L', day:8}, 
    {type:'C', round:3, name:'Ottavi (Ritorno)'},
    {type:'L', day:9}, {type:'L', day:10}, 
    {type:'C', round:4, name:'Quarti (Andata)'},
    {type:'L', day:11}, 
    {type:'C', round:5, name:'Quarti (Ritorno)'},
    {type:'L', day:12}, {type:'L', day:13}, 
    {type:'C', round:6, name:'Semifinale (Andata)'},
    {type:'L', day:14}, 
    {type:'C', round:7, name:'Semifinale (Ritorno)'},
    {type:'L', day:15}, {type:'L', day:16}, {type:'L', day:17}, {type:'L', day:18}, {type:'L', day:19}, {type:'L', day:20}, {type:'L', day:21}, {type:'L', day:22}, {type:'L', day:23}, {type:'L', day:24}, {type:'L', day:25}, {type:'L', day:26},
    {type:'C', round:8, name:'Finale Coppa Nazionale'},
    {type:'P', name:'🔥 PLAYOFF / PLAYOUT'} // SETTIMANA 36
];

export const gameState = {
    userTeam: {
        name: "",
        league: "",
        division: 3,
        coins: 10000,
        gems: 50,
        inventory: { healAll: 0, healPlayer: 0, superBoosts: 0 },
        activeBoostMatches: 0,
        roles: { captain: null, penalty: null },
        colors: { primary: "#00f5a0", secondary: "#ffffff" },
        kitStyle: "solid",
        formation: "2-3-1",
        matchday: 1, 
        seasonWeek: 1, 
        cup: { byes: [], rounds: {} }, 
        playoffWon: false, // Memoria del risultato del playoff
        players: [],
        stats: { points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }
    },
    world: {},
    currentView: "home"
};

export function saveGame() {
    localStorage.setItem('footly_save_data', JSON.stringify(gameState));
}

export function loadGame() {
    const savedData = localStorage.getItem('footly_save_data');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (!parsedData.world || !parsedData.world["Italia"]) { resetGame(); return false; }
        Object.assign(gameState.userTeam, parsedData.userTeam);
        if (parsedData.world) gameState.world = parsedData.world;
        gameState.currentView = parsedData.currentView || "home";

        if (!gameState.userTeam.division) gameState.userTeam.division = 3;
        if (!gameState.userTeam.formation) gameState.userTeam.formation = "2-3-1";
        if (!gameState.userTeam.matchday) gameState.userTeam.matchday = 1;
        if (gameState.userTeam.gems === undefined) gameState.userTeam.gems = 50;
        if (!gameState.userTeam.inventory) gameState.userTeam.inventory = { healAll: 0, healPlayer: 0, superBoosts: 0 };
        if (gameState.userTeam.activeBoostMatches === undefined) gameState.userTeam.activeBoostMatches = 0;
        if (!gameState.userTeam.roles) gameState.userTeam.roles = { captain: null, penalty: null };
        if (gameState.userTeam.seasonWeek === undefined) gameState.userTeam.seasonWeek = gameState.userTeam.matchday; 
        if (!gameState.userTeam.cup) gameState.userTeam.cup = { byes: [], rounds: {} };
        if (gameState.userTeam.playoffWon === undefined) gameState.userTeam.playoffWon = false;

        if (gameState.userTeam.players) {
            gameState.userTeam.players.forEach(p => { 
                if (p.energy === undefined) p.energy = 100; 
                if (p.stats.yellowCards === undefined) p.stats.yellowCards = 0;
                if (p.stats.redCards === undefined) p.stats.redCards = 0;
                if (p.status.yellowCards === undefined) p.status.yellowCards = 0; 
            });
        }
        
        saveGame(); return true;
    }
    return false;
}

export function resetGame() {
    localStorage.removeItem('footly_save_data'); location.reload(); 
}

export function getUserTeamStrength() {
    if(!gameState.userTeam.players || gameState.userTeam.players.length === 0) return 0;
    let starters = gameState.userTeam.players.filter(p => p.isStarter);
    if(starters.length === 0) return 0;
    
    let sum = starters.reduce((acc, p) => {
        if (p.status && p.status.suspended === 2) return acc; 
        return acc + getEffectiveOverall(p);
    }, 0);
    
    let baseStr = Math.floor(sum / starters.length); 
    if (gameState.userTeam.roles && gameState.userTeam.roles.captain) {
        let capOnPitch = starters.find(p => p.id === gameState.userTeam.roles.captain && p.status.suspended === 0);
        if (capOnPitch) baseStr += 1;
    }
    if (gameState.userTeam.activeBoostMatches > 0) baseStr = Math.floor(baseStr * 1.15);
    return baseStr;
}

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export function getGlobalTeam(teamName) {
    if (teamName === gameState.userTeam.name) return { name: teamName, strength: getUserTeamStrength() };
    for (let lg in gameState.world) {
        for (let d of [1, 2, 3]) {
            if (gameState.world[lg][d]) {
                let t = gameState.world[lg][d].find(x => x.name === teamName);
                if (t) return t;
            }
        }
    }
    return { name: teamName, strength: 50 }; 
}

// CALCOLA LA CLASSIFICA REALE IN OGNI MOMENTO
export function getStandings(league, div) {
    let teams = gameState.world[league]?.[div] ? [...gameState.world[league][div]] : [];
    if (gameState.userTeam.league === league && gameState.userTeam.division === div) {
        teams.push({ 
            name: gameState.userTeam.name, isUser: true, strength: getUserTeamStrength(), 
            points: gameState.userTeam.stats.points, played: gameState.userTeam.stats.played,
            goalsFor: gameState.userTeam.stats.goalsFor, goalsAgainst: gameState.userTeam.stats.goalsAgainst
        });
    }
    return teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        let gdA = a.goalsFor - a.goalsAgainst; let gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        return b.goalsFor - a.goalsFor;
    });
}

// DETERMINA GLI SCONTRI DEI PLAYOFF
export function getPlayoffMatchup() {
    let S = getStandings(gameState.userTeam.league, gameState.userTeam.division);
    let uRank = S.findIndex(t => t.isUser) + 1; // Posizione da 1 a 14
    
    if (gameState.userTeam.division === 1 && [11, 12, 13].includes(uRank)) {
        let oppRank = uRank === 11 ? 4 : (uRank === 12 ? 3 : 2);
        return { opp: getStandings(gameState.userTeam.league, 2)[oppRank - 1], isHome: true, type: 'playout' };
    } 
    else if (gameState.userTeam.division === 2) {
        if ([2, 3, 4].includes(uRank)) {
            let oppRank = uRank === 2 ? 13 : (uRank === 3 ? 12 : 11);
            return { opp: getStandings(gameState.userTeam.league, 1)[oppRank - 1], isHome: false, type: 'playoff' };
        } else if ([11, 12, 13].includes(uRank)) {
            let oppRank = uRank === 11 ? 4 : (uRank === 12 ? 3 : 2);
            return { opp: getStandings(gameState.userTeam.league, 3)[oppRank - 1], isHome: true, type: 'playout' };
        }
    } 
    else if (gameState.userTeam.division === 3 && [2, 3, 4].includes(uRank)) {
        let oppRank = uRank === 2 ? 13 : (uRank === 3 ? 12 : 11);
        return { opp: getStandings(gameState.userTeam.league, 2)[oppRank - 1], isHome: false, type: 'playoff' };
    }
    return null; // Se riturna null, il giocatore non fa i playoff
}

export function simulateCupRound(roundIndex) {
    if(!gameState.userTeam.cup || !gameState.userTeam.cup.rounds || !gameState.userTeam.cup.rounds[roundIndex]) return;
    let roundMatches = gameState.userTeam.cup.rounds[roundIndex];
    let nextRoundIndex = roundIndex + 1;
    let advancingTeams = [];

    roundMatches.forEach(m => {
        if (m.home === gameState.userTeam.name || m.away === gameState.userTeam.name) return; 

        let t1 = getGlobalTeam(m.home); let t2 = getGlobalTeam(m.away);
        let w1 = Math.pow(t1.strength, 2); let w2 = Math.pow(t2.strength, 2);
        let diff = Math.abs(t1.strength - t2.strength);
        let totalChances = randomInt(3, 5) + Math.floor(diff / 8);

        let g1=0, g2=0;
        for(let i=0; i<totalChances; i++) {
            if (Math.random()*(w1+w2) < w1) { if(Math.random()>0.4) g1++; } else { if(Math.random()>0.4) g2++; }
        }
        m.scoreHome = g1; m.scoreAway = g2;

        let isSingleLeg = [0, 1, 8].includes(roundIndex); let isSecondLeg = [3, 5, 7].includes(roundIndex);

        if (isSingleLeg) {
            if (g1 === g2) { if(Math.random()>0.5) m.scoreHome++; else m.scoreAway++; } 
            advancingTeams.push(m.scoreHome > m.scoreAway ? m.home : m.away);
        } else if (isSecondLeg) {
            let prevM = gameState.userTeam.cup.rounds[roundIndex-1].find(pm => (pm.home===m.home && pm.away===m.away) || (pm.home===m.away && pm.away===m.home));
            let agg1 = g1 + (prevM.home === m.home ? prevM.scoreHome : prevM.scoreAway);
            let agg2 = g2 + (prevM.away === m.away ? prevM.scoreHome : prevM.scoreAway);
            if (agg1 === agg2) { if(Math.random()>0.5) agg1++; else agg2++; } 
            advancingTeams.push(agg1 > agg2 ? m.home : m.away);
        }
    });

    if ([0, 1, 3, 5, 7].includes(roundIndex)) {
        if (roundIndex === 0 && gameState.userTeam.cup.byes) advancingTeams.push(...gameState.userTeam.cup.byes);
        advancingTeams.sort(() => Math.random() - 0.5); 
        let nextMatches = [];
        for(let i=0; i<advancingTeams.length; i+=2) {
            if (advancingTeams[i] && advancingTeams[i+1]) nextMatches.push({ home: advancingTeams[i], away: advancingTeams[i+1], scoreHome: null, scoreAway: null });
        }
        gameState.userTeam.cup.rounds[nextRoundIndex] = nextMatches;
    } else if ([2, 4, 6].includes(roundIndex)) {
        let nextMatches = roundMatches.map(m => ({ home: m.away, away: m.home, scoreHome: null, scoreAway: null }));
        gameState.userTeam.cup.rounds[nextRoundIndex] = nextMatches;
    }
}

export function generateCupBracket() {
    let teams = [];
    for(let lg in gameState.world) { [1,2,3].forEach(d => gameState.world[lg][d].forEach(t => teams.push(t.name))); }
    teams.push(gameState.userTeam.name);
    teams.sort((a,b) => getGlobalTeam(b).strength - getGlobalTeam(a).strength); 
    
    let byes = teams.slice(0, 22);
    let prelims = teams.slice(22).sort(() => Math.random()-0.5);
    let r0 = [];
    for(let i=0; i<10; i++) r0.push({home: prelims[i*2], away: prelims[i*2+1], scoreHome:null, scoreAway:null});
    
    gameState.userTeam.cup = { byes: byes, rounds: { 0: r0, 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[] } };
}