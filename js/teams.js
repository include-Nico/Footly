// js/teams.js
import { generatePlayer } from './players.js';

const LEAGUES_DB = {
    "Italia": {
        1: ["Piemonte Bianconero", "Milano Diavolo", "Milano Biscione", "Napoli Vesuvio", "Roma Lupa", "Roma Aquila", "Bergamo Dea", "Firenze Viola", "Torino Granata", "Bologna Rossoblu", "Genova Grifone", "Sassuolo Neroverde", "Udine Friuli", "Verona Gialloblu"],
        2: ["Palermo Aquile", "Bari Galletti", "Venezia Leoni", "Parma Crociati", "Brescia Rondinelle", "Lecce Lupi", "Cagliari Sardi", "Pisa Torre", "Como Lariani", "Cremona Tigri", "Frosinone Giallo", "Ascoli Picchio", "Spezia Bianconeri", "Catanzaro Sud"],
        3: ["Catania Elefante", "Foggia Satanelli", "Avellino Lupi", "Padova Scudi", "Vicenza Rossi", "Mantova Virgiliani", "Cesena Cavallucci", "Spal Estensi", "Taranto Delfini", "Juve Stabia", "Latina Pontini", "Arezzo Cavallo", "Rimini Riviera"] // 13 CPU, il 14esimo è l'utente
    },
    // Default Generico
    "Default": {
        1: ["Real Madrid FC", "Barcellona FC", "Manchester Rossi", "Monaco Bayern", "Parigi Saint", "Londra Cannoni", "Liverpool Reds", "Madrid Colchoneros", "Londra Blues", "Tottenham", "Marsiglia OM", "Dortmund", "Porto Draghi", "Lisbona Aquile"],
        2: ["Siviglia FC", "Valencia", "Everton", "Newcastle", "Lione OL", "Lipsia RB", "Leverkusen", "Sporting", "Betis", "Aston Villa", "West Ham", "Brighton", "Lille", "Francoforte"],
        3: ["Villarreal", "Celta", "Fulham", "Palace", "Bordeaux", "Stoccarda", "Braga", "Amburgo", "Schalke", "Saint-Etienne", "Leicester", "Leeds", "Southampton", "Boavista"]
    }
};

// Costruisce l'Ecosistema Globale all'Onboarding
export function initializeWorld(leagueName) {
    const db = LEAGUES_DB[leagueName] || LEAGUES_DB["Default"];
    let world = { 1: [], 2: [], 3: [] };

    // Genera squadre e rose per ogni divisione
    [1, 2, 3].forEach(division => {
        let cpuTeamNames = db[division];
        
        cpuTeamNames.forEach(teamName => {
            let roster = [];
            let totalStarterOverall = 0;
            
            for(let i=0; i<14; i++) {
                const pos = ['POR', 'DIF', 'DIF', 'CEN', 'CEN', 'ATT'][Math.floor(Math.random()*6)];
                
                // La magia: Div 1 ha Epic/Legend, Div 2 ha Gold/Rare, Div 3 ha Bronze/Silver!
                let forcedRarity = 'BRONZE';
                const rand = Math.random();
                if(division === 1) {
                    if(rand > 0.95) forcedRarity = 'LEGEND';
                    else if(rand > 0.70) forcedRarity = 'EPIC';
                    else if(rand > 0.30) forcedRarity = 'SUPERRARE';
                    else forcedRarity = 'GOLD';
                } else if(division === 2) {
                    if(rand > 0.90) forcedRarity = 'RAREGOLD';
                    else if(rand > 0.40) forcedRarity = 'GOLD';
                    else forcedRarity = 'SILVER';
                } else {
                    if(rand > 0.90) forcedRarity = 'GOLD';
                    else if(rand > 0.60) forcedRarity = 'SILVER';
                }

                const p = generatePlayer(pos, i < 7, forcedRarity);
                roster.push(p);
                if(i < 7) totalStarterOverall += p.overall;
            }

            world[division].push({
                name: teamName,
                isUser: false,
                strength: Math.floor(totalStarterOverall / 7),
                points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
                roster: roster
            });
        });
    });

    return world;
}