// js/state.js
import { getEffectiveOverall } from './players.js'; 

export const SEASON_SCHEDULE = [
    {type:'L', day:1}, {type:'L', day:2}, {type:'C', round:0, name:'Preliminari Coppa Naz.'},
    {type:'L', day:3}, {type:'L', day:4}, {type:'CC', round:0, name:'Gironi Champions (1)'},
    {type:'L', day:5}, {type:'L', day:6}, {type:'C', round:1, name:'Sedicesimi Coppa Naz.'},
    {type:'L', day:7}, {type:'CC', round:1, name:'Gironi Champions (2)'},
    {type:'L', day:8}, {type:'C', round:2, name:'Ottavi Coppa Naz. (A)'},
    {type:'L', day:9}, {type:'CC', round:2, name:'Gironi Champions (3)'},
    {type:'L', day:10}, {type:'C', round:3, name:'Ottavi Coppa Naz. (R)'},
    {type:'L', day:11}, {type:'CC', round:3, name:'Gironi Champions (4)'},
    {type:'L', day:12}, {type:'C', round:4, name:'Quarti Coppa Naz. (A)'},
    {type:'L', day:13}, {type:'CC', round:4, name:'Gironi Champions (5)'},
    {type:'L', day:14}, {type:'C', round:5, name:'Quarti Coppa Naz. (R)'},
    {type:'L', day:15}, {type:'CC', round:5, name:'Quarti Champions (A)'},
    {type:'L', day:16}, {type:'C', round:6, name:'Semifinale Coppa Naz. (A)'},
    {type:'L', day:17}, {type:'CC', round:6, name:'Quarti Champions (R)'},
    {type:'L', day:18}, {type:'C', round:7, name:'Semifinale Coppa Naz. (R)'},
    {type:'L', day:19}, {type:'CC', round:7, name:'Semifinale Champions (A)'},
    {type:'L', day:20}, {type:'L', day:21}, {type:'CC', round:8, name:'Semifinale Champions (R)'},
    {type:'L', day:22}, {type:'L', day:23}, {type:'L', day:24}, {type:'L', day:25}, {type:'L', day:26},
    {type:'C', round:8, name:'Finale Coppa Nazionale'},
    {type:'CC', round:9, name:'FINALE CHAMPIONS'},
    {type:'P', name:'🔥 PLAYOFF / PLAYOUT'} 
]; 

export const gameState = {
    userTeam: {
        name: "", league: "", division: 3,
        coins: 10000, gems: 50,
        inventory: { healAll: 0, healPlayer: 0, superBoosts: 0 },
        activeBoostMatches: 0,
        roles: { captain: null, penalty: null },
        colors: { primary: "#00f5a0", secondary: "#ffffff" },
        kitStyle: "solid",
        ownedKits: ["solid", "stripes", "halves"], 
        seasonYear: 1, 
        matchday: 1, 
        seasonWeek: 1, 
        cup: { byes: [], rounds: {} }, 
        champions: { groups: [], groupStandings: [], rounds: {} }, 
        palmares: [], 
        playoffWon: false,
        players: [],
        stats: { points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }
    },
    world: {},
    currentView: "home"
};

function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { r = "0x" + hex[1] + hex[1]; g = "0x" + hex[2] + hex[2]; b = "0x" + hex[3] + hex[3]; } 
    else if (hex.length === 7) { r = "0x" + hex[1] + hex[2]; g = "0x" + hex[3] + hex[4]; b = "0x" + hex[5] + hex[6]; }
    return `${+r}, ${+g}, ${+b}`;
}

export function getKitCSS(c1, c2, style) {
    switch(style) {
        case 'stripes': return `background: repeating-linear-gradient(90deg, ${c1} 0px, ${c1} 20%, ${c2} 20%, ${c2} 40%);`;
        case 'halves': return `background: linear-gradient(90deg, ${c1} 50%, ${c2} 50%);`;
        case 'diagonal': return `background: linear-gradient(135deg, ${c1} 50%, ${c2} 50%);`;
        case 'hoops': return `background: repeating-linear-gradient(0deg, ${c1} 0px, ${c1} 20%, ${c2} 20%, ${c2} 40%);`;
        case 'checkered': return `background-color: ${c1}; background-image: conic-gradient(${c1} 90deg, ${c2} 90deg 180deg, ${c1} 180deg 270deg, ${c2} 270deg); background-size: 50% 50%;`;
        case 'camouflage': return `background-color: ${c1}; background-image: radial-gradient(circle at 20% 30%, ${c2} 30%, transparent 30%), radial-gradient(circle at 80% 70%, ${c2} 30%, transparent 30%);`;
        case 'solid': default: return `background: ${c1};`;
    }
}

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
        if (gameState.userTeam.playoffWon === undefined) gameState.userTeam.playoffWon = false;
        
        if (!gameState.userTeam.seasonYear) gameState.userTeam.seasonYear = 1;
        if (!gameState.userTeam.palmares) gameState.userTeam.palmares = [];
        
        if (!gameState.userTeam.ownedKits) gameState.userTeam.ownedKits = ["solid", "stripes", "halves"];

        if (!gameState.userTeam.cup || !gameState.userTeam.cup.rounds || !gameState.userTeam.cup.rounds[0] || gameState.userTeam.cup.rounds[0].length === 0) {
            generateCupBracket();
        }
        if (!gameState.userTeam.champions || !gameState.userTeam.champions.rounds || !gameState.userTeam.champions.rounds[0] || gameState.userTeam.champions.rounds[0].length === 0) {
            generateChampionsBracket();
        }

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

export function resetGame() { localStorage.removeItem('footly_save_data'); location.reload(); }

export function getUserTeamStrength() {
    if(!gameState.userTeam.players || gameState.userTeam.players.length === 0) return 0;
    let starters = gameState.userTeam.players.filter(p => p.isStarter);
    if(starters.length === 0) return 0;
    
    let sum = starters.reduce((acc, p) => { if (p.status && p.status.suspended === 2) return acc; return acc + getEffectiveOverall(p); }, 0);
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
            if (gameState.world[lg][d]) { let t = gameState.world[lg][d].find(x => x.name === teamName); if (t) return t; }
        }
    }
    return { name: teamName, strength: 50 }; 
}

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

export function getPlayoffMatchup() {
    let S = getStandings(gameState.userTeam.league, gameState.userTeam.division);
    let uRank = S.findIndex(t => t.isUser) + 1; 
    if (gameState.userTeam.division === 1 && [11, 12, 13].includes(uRank)) {
        let oppRank = uRank === 11 ? 4 : (uRank === 12 ? 3 : 2); return { opp: getStandings(gameState.userTeam.league, 2)[oppRank - 1], isHome: true, type: 'playout' };
    } else if (gameState.userTeam.division === 2) {
        if ([2, 3, 4].includes(uRank)) { let oppRank = uRank === 2 ? 13 : (uRank === 3 ? 12 : 11); return { opp: getStandings(gameState.userTeam.league, 1)[oppRank - 1], isHome: false, type: 'playoff' }; } 
        else if ([11, 12, 13].includes(uRank)) { let oppRank = uRank === 11 ? 4 : (uRank === 12 ? 3 : 2); return { opp: getStandings(gameState.userTeam.league, 3)[oppRank - 1], isHome: true, type: 'playout' }; }
    } else if (gameState.userTeam.division === 3 && [2, 3, 4].includes(uRank)) {
        let oppRank = uRank === 2 ? 13 : (uRank === 3 ? 12 : 11); return { opp: getStandings(gameState.userTeam.league, 2)[oppRank - 1], isHome: false, type: 'playoff' };
    }
    return null; 
}

export function simulateCupRound(roundIndex) {
    if(!gameState.userTeam.cup || !gameState.userTeam.cup.rounds || !gameState.userTeam.cup.rounds[roundIndex]) return;
    let roundMatches = gameState.userTeam.cup.rounds[roundIndex];
    let nextRoundIndex = roundIndex + 1;
    let advancingTeams = [];

    roundMatches.forEach(m => {
        let g1, g2;
        if (m.home === gameState.userTeam.name || m.away === gameState.userTeam.name) {
            g1 = m.scoreHome !== null ? m.scoreHome : 0;
            g2 = m.scoreAway !== null ? m.scoreAway : 0;
        } else {
            let t1 = getGlobalTeam(m.home); let t2 = getGlobalTeam(m.away);
            let w1 = Math.pow(t1.strength, 2); let w2 = Math.pow(t2.strength, 2);
            let diff = Math.abs(t1.strength - t2.strength); let totalChances = randomInt(3, 5) + Math.floor(diff / 8);
            g1=0; g2=0;
            for(let i=0; i<totalChances; i++) { if (Math.random()*(w1+w2) < w1) { if(Math.random()>0.4) g1++; } else { if(Math.random()>0.4) g2++; } }
            m.scoreHome = g1; m.scoreAway = g2;
        }

        let isSingleLeg = [0, 1, 8].includes(roundIndex); 
        let isSecondLeg = [3, 5, 7].includes(roundIndex);

        if (isSingleLeg) {
            if (g1 === g2) { 
                if (m.home === gameState.userTeam.name || m.away === gameState.userTeam.name) {
                    if(Math.random()>0.5) m.scoreHome++; else m.scoreAway++;
                } else {
                    if(Math.random()>0.5) m.scoreHome++; else m.scoreAway++; 
                }
            } 
            advancingTeams.push(m.scoreHome > m.scoreAway ? m.home : m.away);
        } else if (isSecondLeg) {
            let prevM = gameState.userTeam.cup.rounds[roundIndex-1].find(pm => (pm.home===m.home && pm.away===m.away) || (pm.home===m.away && pm.away===m.home));
            let prevH = prevM.home === m.home ? prevM.scoreHome : prevM.scoreAway;
            let prevA = prevM.away === m.away ? prevM.scoreHome : prevM.scoreAway;
            let agg1 = m.scoreHome + prevH;
            let agg2 = m.scoreAway + prevA;
            if (agg1 === agg2) { 
                if(Math.random()>0.5) agg1++; else agg2++; 
            } 
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
    let lg = gameState.userTeam.league;
    
    [1,2,3].forEach(d => {
        if (gameState.world[lg] && gameState.world[lg][d]) {
            gameState.world[lg][d].forEach(t => teams.push(t.name));
        }
    });
    teams.push(gameState.userTeam.name);
    
    teams.sort((a,b) => getGlobalTeam(b).strength - getGlobalTeam(a).strength); 
    
    let byes = teams.slice(0, 22);
    let prelims = teams.slice(22).sort(() => Math.random()-0.5);
    
    let r0 = [];
    for(let i=0; i<10; i++) {
        r0.push({home: prelims[i*2], away: prelims[i*2+1], scoreHome:null, scoreAway:null});
    }
    
    gameState.userTeam.cup = { byes: byes, rounds: { 0: r0, 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[] } };
}

export function simulateChampionsRound(roundIndex) {
    if(!gameState.userTeam.champions || !gameState.userTeam.champions.rounds[roundIndex]) return;
    let roundMatches = gameState.userTeam.champions.rounds[roundIndex]; 
    let nextRoundIndex = roundIndex + 1; 
    let advancingTeams = [];
    
    roundMatches.forEach(m => {
        let g1, g2;
        if (m.home === gameState.userTeam.name || m.away === gameState.userTeam.name) {
            g1 = m.scoreHome !== null ? m.scoreHome : 0;
            g2 = m.scoreAway !== null ? m.scoreAway : 0;
        } else {
            let t1 = getGlobalTeam(m.home); let t2 = getGlobalTeam(m.away);
            let w1 = Math.pow(t1.strength, 2); let w2 = Math.pow(t2.strength, 2);
            let diff = Math.abs(t1.strength - t2.strength); let totalChances = randomInt(3, 5) + Math.floor(diff / 8);
            g1=0; g2=0;
            for(let i=0; i<totalChances; i++) { if (Math.random()*(w1+w2) < w1) { if(Math.random()>0.4) g1++; } else { if(Math.random()>0.4) g2++; } }
            m.scoreHome = g1; m.scoreAway = g2;
        }

        if (roundIndex < 5) {
            let st1 = gameState.userTeam.champions.groupStandings[m.group].find(s => s.name === m.home);
            let st2 = gameState.userTeam.champions.groupStandings[m.group].find(s => s.name === m.away);
            st1.gf += m.scoreHome; st1.ga += m.scoreAway; st2.gf += m.scoreAway; st2.ga += m.scoreHome;
            if (m.scoreHome > m.scoreAway) st1.pts += 3; else if (m.scoreHome < m.scoreAway) st2.pts += 3; else { st1.pts += 1; st2.pts += 1; }
        } else {
            let isSingleLeg = [9].includes(roundIndex); let isSecondLeg = [6, 8].includes(roundIndex);
            if (isSingleLeg) {
                if (m.scoreHome === m.scoreAway) { if(Math.random()>0.5) m.scoreHome++; else m.scoreAway++; } 
                advancingTeams.push(m.scoreHome > m.scoreAway ? m.home : m.away);
            } else if (isSecondLeg) {
                let prevM = gameState.userTeam.champions.rounds[roundIndex-1].find(pm => (pm.home===m.home && pm.away===m.away) || (pm.home===m.away && pm.away===m.home));
                let prevH = prevM.home === m.home ? prevM.scoreHome : prevM.scoreAway;
                let prevA = prevM.away === m.away ? prevM.scoreHome : prevM.scoreAway;
                let agg1 = m.scoreHome + prevH;
                let agg2 = m.scoreAway + prevA;
                if (agg1 === agg2) { if(Math.random()>0.5) agg1++; else agg2++; } 
                advancingTeams.push(agg1 > agg2 ? m.home : m.away);
            }
        }
    });

    if (roundIndex === 4) {
        for (let g=0; g<4; g++) {
            let st = gameState.userTeam.champions.groupStandings[g];
            st.sort((a,b) => { if (b.pts !== a.pts) return b.pts - a.pts; let gdA = a.gf - a.ga; let gdB = b.gf - b.ga; if (gdA !== gdB) return gdB - gdA; return b.gf - a.gf; });
            advancingTeams.push(st[0].name, st[1].name); 
        }
        let nextMatches = [ {home: advancingTeams[0], away: advancingTeams[3], scoreHome: null, scoreAway: null}, {home: advancingTeams[2], away: advancingTeams[1], scoreHome: null, scoreAway: null}, {home: advancingTeams[4], away: advancingTeams[7], scoreHome: null, scoreAway: null}, {home: advancingTeams[6], away: advancingTeams[5], scoreHome: null, scoreAway: null} ];
        gameState.userTeam.champions.rounds[5] = nextMatches;
    } else if ([6, 8].includes(roundIndex)) {
        advancingTeams.sort(() => Math.random() - 0.5); 
        let nextMatches = [];
        for(let i=0; i<advancingTeams.length; i+=2) { if (advancingTeams[i] && advancingTeams[i+1]) nextMatches.push({ home: advancingTeams[i], away: advancingTeams[i+1], scoreHome: null, scoreAway: null }); }
        gameState.userTeam.champions.rounds[nextRoundIndex] = nextMatches;
    } else if ([5, 7].includes(roundIndex)) {
        let nextMatches = roundMatches.map(m => ({ home: m.away, away: m.home, scoreHome: null, scoreAway: null }));
        gameState.userTeam.champions.rounds[nextRoundIndex] = nextMatches;
    }
}

export function generateChampionsBracket(qualifiedTeams = null) {
    if (!qualifiedTeams || qualifiedTeams.length !== 20) {
        qualifiedTeams = [];
        for (let lg in gameState.world) {
            let div1 = [...gameState.world[lg][1]];
            if (gameState.userTeam.league === lg && gameState.userTeam.division === 1) div1.push({ name: gameState.userTeam.name, strength: getUserTeamStrength() });
            div1.sort((a,b) => b.strength - a.strength);
            qualifiedTeams.push(...div1.slice(0, 5).map(t => t.name));
        }
    }
    
    qualifiedTeams.sort(() => Math.random() - 0.5);
    
    let groups = [[], [], [], []]; let groupStandings = [[], [], [], []];
    for (let i=0; i<20; i++) {
        let gIdx = Math.floor(i / 5); groups[gIdx].push(qualifiedTeams[i]); groupStandings[gIdx].push({name: qualifiedTeams[i], pts: 0, gf: 0, ga: 0});
    }

    let rounds = {};
    for (let md=0; md<5; md++) {
        rounds[md] = [];
        for (let g=0; g<4; g++) {
            let gTeams = groups[g];
            let pairings = [ [[0,1], [2,3]], [[0,2], [4,1]], [[0,3], [2,4]], [[0,4], [3,1]], [[1,2], [3,4]] ];
            pairings[md].forEach(pair => { rounds[md].push({ home: gTeams[pair[0]], away: gTeams[pair[1]], scoreHome: null, scoreAway: null, group: g }); });
        }
    }
    for(let r=5; r<=9; r++) rounds[r] = [];

    gameState.userTeam.champions = { groups, groupStandings, rounds };
}