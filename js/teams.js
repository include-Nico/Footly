// js/teams.js
import { generatePlayer } from './players.js';

const LEAGUES_DB = {
    "Italia": {
        1: ["Piemonte Bianconero", "Milano Diavolo", "Milano Biscione", "Napoli Vesuvio", "Roma Lupa", "Roma Aquila", "Bergamo Dea", "Firenze Viola", "Torino Granata", "Bologna Rossoblu", "Genova Grifone", "Sassuolo Neroverde", "Udine Friuli", "Verona Gialloblu"],
        2: ["Palermo Aquile", "Bari Galletti", "Venezia Leoni", "Parma Crociati", "Brescia Rondinelle", "Lecce Lupi", "Cagliari Sardi", "Pisa Torre", "Como Lariani", "Cremona Tigri", "Frosinone Giallo", "Ascoli Picchio", "Spezia Bianconeri", "Catanzaro Sud"],
        3: ["Catania Elefante", "Foggia Satanelli", "Avellino Lupi", "Padova Scudi", "Vicenza Rossi", "Mantova Virgiliani", "Cesena Cavallucci", "Spal Estensi", "Taranto Delfini", "Juve Stabia", "Latina Pontini", "Arezzo Cavallo", "Rimini Riviera", "Lucchese Pantere"]
    },
    "Spagna": {
        1: ["Madrid Blanca", "Catalogna FC", "Madrid Colchoneros", "Siviglia FC", "Betis Bianco-Verde", "Valencia Pipistrelli", "Baschi Bilbao", "Real San Sebastian", "Villarreal Gialli", "Celta Galizia", "Osasuna Rossi", "Getafe Azzurri", "Maiorca Isole", "Almeria FC"],
        2: ["Saragozza Leoni", "Sporting Gijon", "Tenerife Canarie", "Las Palmas", "Levante Rane", "Eibar Armeros", "Alaves Babazorros", "Valladolid Pucela", "Oviedo Blu", "Burgos CF", "Cartagena", "Huesca Rossi", "Mirandes", "Leganes"],
        3: ["Deportivo La Coruna", "Racing Santander", "Murcia Imperial", "Cordoba Califfi", "Ibiza FC", "Marbella", "Recreativo Huelva", "Logrones", "Numancia", "Gimnastic", "Cultural Leonesa", "Ponferradina", "Sabadell", "Mala CF"]
    },
    "Inghilterra": {
        1: ["Manchester Rossi", "Manchester Azzurri", "Londra Cannoni", "Londra Blues", "Liverpool Reds", "Tottenham Spurs", "Newcastle Magpies", "Aston Villa Leoni", "West Ham Martelli", "Everton Toffees", "Brighton Gabbiani", "Fulham Cottagers", "Crystal Palace Aquile", "Lupi Wolverhampton"],
        2: ["Leicester Volpi", "Leeds Bianchi", "Southampton Santi", "Sunderland Gatti", "Middlesbrough Rossi", "Ipswich Trattori", "Norwich Canarini", "West Bromwich", "Coventry Azzurri", "Millwall Leoni", "Swansea Cigni", "Cardiff Draghi", "Stoke Vasai", "Preston Gigli"],
        3: ["Portsmouth Pompey", "Bolton Trotters", "Charlton Addicks", "Derby Arieti", "Sheffield Gufi", "Reading Reali", "Wigan Latics", "Barnsley Rossi", "Blackpool Mandarini", "Rotherham", "Leyton Orient", "Carlisle Blu", "Port Vale", "Crewe Alexandra"]
    },
    "Default": {
        1: ["Bayern Monaco FC", "Dortmund Gialli", "Parigi Saint", "Marsiglia OM", "Lione OL", "Porto Draghi", "Lisbona Aquile", "Sporting Leoni", "Lipsia RB", "Lille Mastini", "Monaco Principato", "Leverkusen", "Francoforte", "Stoccarda"],
        2: ["Amburgo SV", "Schalke Blu", "Bordeaux FC", "Saint-Etienne", "Metz FC", "Boavista", "Braga Guerrieri", "Hannover 96", "Norimberga", "Auxerre", "Guingamp", "Sochaux", "Norimberga", "Kaiserslautern"],
        3: ["Monaco 1860", "Dinamo Dresda", "Red Star Parigi", "Nancy", "Le Mans", "Belenenses", "Vitoria FC", "Osnabruck", "Saarbrucken", "Sedan", "Tours", "Leiria", "Setubal", "Farense"]
    }
};

export function initializeLeague(userTeamName, leagueName, division) {
    const db = LEAGUES_DB[leagueName] || LEAGUES_DB["Default"];
    const cpuTeamNames = db[division] || db[3];

    let standings = [];

    standings.push({
        name: userTeamName,
        isUser: true,
        strength: 60, 
        points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
        roster: [] 
    });

    cpuTeamNames.forEach(teamName => {
        let roster = [];
        let totalStarterOverall = 0;
        
        for(let i=0; i<14; i++) {
            const pos = ['POR', 'DIF', 'DIF', 'CEN', 'CEN', 'ATT'][Math.floor(Math.random()*6)];
            
            // FIX MERCATO: Generazione ponderata per avere giocatori interessanti
            let forcedRarity = 'BRONZE';
            const rand = Math.random();
            if(division === 3) {
                if(rand > 0.95) forcedRarity = 'GOLD';
                else if(rand > 0.75) forcedRarity = 'SILVER';
            } else if(division === 2) {
                if(rand > 0.90) forcedRarity = 'RAREGOLD';
                else if(rand > 0.60) forcedRarity = 'GOLD';
                else if(rand > 0.2) forcedRarity = 'SILVER';
            } else {
                if(rand > 0.90) forcedRarity = 'EPIC';
                else if(rand > 0.70) forcedRarity = 'SUPERRARE';
                else if(rand > 0.40) forcedRarity = 'GOLD';
                else forcedRarity = 'SILVER';
            }

            const p = generatePlayer(pos, i < 7, forcedRarity);
            roster.push(p);
            if(i < 7) totalStarterOverall += p.overall;
        }

        standings.push({
            name: teamName,
            isUser: false,
            strength: Math.floor(totalStarterOverall / 7), 
            points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
            roster: roster
        });
    });

    return standings;
}

export function simulateCPUMatch(teamA, teamB) {
    const totalStrength = teamA.strength + teamB.strength;
    const randomRoll = Math.random() * totalStrength;

    let goalsA = 0, goalsB = 0;
    if (randomRoll <= teamA.strength) {
        goalsA = Math.floor(Math.random() * 3) + 1;
        goalsB = Math.floor(Math.random() * 2);
        if (Math.random() > 0.8) goalsB = goalsA;
    } else {
        goalsB = Math.floor(Math.random() * 3) + 1;
        goalsA = Math.floor(Math.random() * 2);
        if (Math.random() > 0.8) goalsA = goalsB;
    }
    return { goalsA, goalsB };
}