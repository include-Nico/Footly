// js/teams.js

// Database dei club per nazione e divisione (Nomi storpiati no-copyright)
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
    // Fallback generico per Germania, Francia e Portogallo per non appesantire il file
    "Default": {
        1: ["Bayern Monaco FC", "Dortmund Gialli", "Parigi Saint", "Marsiglia OM", "Lione OL", "Porto Draghi", "Lisbona Aquile", "Sporting Leoni", "Lipsia RB", "Lille Mastini", "Monaco Principato", "Leverkusen", "Francoforte", "Stoccarda"],
        2: ["Amburgo SV", "Schalke Blu", "Bordeaux FC", "Saint-Etienne", "Metz FC", "Boavista", "Braga Guerrieri", "Hannover 96", "Norimberga", "Auxerre", "Guingamp", "Sochaux", "Norimberga", "Kaiserslautern"],
        3: ["Monaco 1860", "Dinamo Dresda", "Red Star Parigi", "Nancy", "Le Mans", "Belenenses", "Vitoria FC", "Osnabruck", "Saarbrucken", "Sedan", "Tours", "Leiria", "Setubal", "Farense"]
    }
};

// Genera la classifica iniziale con le squadre CPU e la squadra dell'utente
export function initializeLeague(userTeamName, leagueName, division) {
    const db = LEAGUES_DB[leagueName] || LEAGUES_DB["Default"];
    const cpuTeamNames = db[division] || db[3]; // Fallback alla div 3 se non trovata

    // Determiniamo la forza base in base alla divisione (Div 1: 80-95, Div 2: 70-80, Div 3: 55-70)
    let minStr = 55, maxStr = 70;
    if (division === 2) { minStr = 70; maxStr = 80; }
    if (division === 1) { minStr = 80; maxStr = 95; }

    let standings = [];

    // Aggiungi la squadra dell'utente
    standings.push({
        name: userTeamName,
        isUser: true,
        strength: Math.floor((minStr + maxStr) / 2), // Forza media stimata
        points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0
    });

    // Aggiungi le 14 squadre CPU
    cpuTeamNames.forEach(teamName => {
        standings.push({
            name: teamName,
            isUser: false,
            strength: Math.floor(Math.random() * (maxStr - minStr + 1)) + minStr,
            points: 0, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0
        });
    });

    return standings;
}

// Simulatore Partita "Testa a Testa" per squadre CPU
export function simulateCPUMatch(teamA, teamB) {
    const totalStrength = teamA.strength + teamB.strength;
    const randomRoll = Math.random() * totalStrength;

    let goalsA = 0;
    let goalsB = 0;

    // Chi vince il roll iniziale ha più probabilità di segnare di più
    if (randomRoll <= teamA.strength) {
        // Vantaggio Team A
        goalsA = Math.floor(Math.random() * 3) + 1; // 1-3 gol
        goalsB = Math.floor(Math.random() * 2);     // 0-1 gol
        // 20% di probabilità di pareggio casuale (il calcio è strano!)
        if (Math.random() > 0.8) goalsB = goalsA;
    } else {
        // Vantaggio Team B
        goalsB = Math.floor(Math.random() * 3) + 1;
        goalsA = Math.floor(Math.random() * 2);
        if (Math.random() > 0.8) goalsA = goalsB;
    }

    return { goalsA, goalsB };
}