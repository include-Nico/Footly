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
    "Germania": {
        1: ["Bayern Monaco FC", "Dortmund Gialli", "Lipsia RB", "Leverkusen", "Francoforte", "Stoccarda", "Wolfsburg", "Monchengladbach", "Friburgo", "Brema", "Berlino Azzurri", "Hoffenheim", "Colonia", "Magonza"],
        2: ["Amburgo SV", "Schalke Blu", "Hannover 96", "Norimberga", "Kaiserslautern", "Dusseldorf", "Sankt Pauli", "Karlsruhe", "Bochum", "Paderborn", "Kiel", "Magdeburgo", "Greuther Furth", "Rostock"],
        3: ["Monaco 1860", "Dinamo Dresda", "Osnabruck", "Saarbrucken", "Duisburg", "Essen", "Bielefeld", "Mannheim", "Aue", "Hallescher", "Wiesbaden", "Verl", "Ingolstadt", "Zwickau"]
    }
};

// Genera l'INTERO MONDO
export function initializeWorld(userLeagueName) {
    let world = {};
    
    for (let league in LEAGUES_DB) {
        world[league] = { 1: [], 2: [], 3: [] };
        
        [1, 2, 3].forEach(div => {
            let cpuTeamNames = [...LEAGUES_DB[league][div]];
            
            // L'utente ruba il posto a una squadra nella sua nazione e divisione!
            if (league === userLeagueName && div === 3) {
                cpuTeamNames.pop(); // Rimangono 13 CPU
            }

            cpuTeamNames.forEach(teamName => {
                let roster = [];
                let totalStarterOverall = 0;
                let hasTopTier = false; 
                
                for(let i=0; i<14; i++) {
                    const pos = ['POR', 'DIF', 'DIF', 'CEN', 'CEN', 'ATT'][Math.floor(Math.random()*6)];
                    
                    let forcedRarity = 'BRONZE';
                    const rand = Math.random();

                    if(div === 1) {
                        if(rand > 0.90 && !hasTopTier && Math.random() > 0.5) { 
                            forcedRarity = Math.random() > 0.8 ? 'LEGEND' : 'EPIC';
                            hasTopTier = true; 
                        } else if(rand > 0.80) forcedRarity = 'SUPERRARE';
                        else if(rand > 0.40) forcedRarity = 'RAREGOLD';
                        else forcedRarity = 'GOLD';
                    } else if(div === 2) {
                        if(rand > 0.85) forcedRarity = 'RAREGOLD';
                        else if(rand > 0.40) forcedRarity = 'GOLD';
                        else forcedRarity = 'SILVER';
                    } else { 
                        if(rand > 0.80) forcedRarity = 'SILVER';
                        else forcedRarity = 'BRONZE';
                    }

                    const p = generatePlayer(pos, i < 7, forcedRarity);
                    roster.push(p);
                    if(i < 7) totalStarterOverall += p.overall;
                }

                world[league][div].push({
                    name: teamName,
                    league: league, // Salviamo la nazione del club
                    isUser: false,
                    strength: Math.floor(totalStarterOverall / 7),
                    points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
                    roster: roster
                });
            });
        });
    }

    return world;
}