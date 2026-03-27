// js/players.js

// Definizione delle rarità basate sull'Overall
export const RARITIES = {
    BRONZE: { name: 'Bronzo', min: 50, max: 64, color: 'var(--rarity-bronze)' },
    SILVER: { name: 'Argento', min: 65, max: 74, color: 'var(--rarity-silver)' },
    GOLD: { name: 'Oro', min: 75, max: 80, color: 'var(--rarity-gold)' },
    RAREGOLD: { name: 'Oro Raro', min: 81, max: 84, color: 'var(--rarity-rare-gold)' },
    SUPERRARE: { name: 'Super Raro', min: 85, max: 88, color: 'var(--rarity-super-rare)' },
    EPIC: { name: 'Epico', min: 89, max: 92, color: 'var(--rarity-epic)' },
    LEGEND: { name: 'Leggenda', min: 93, max: 99, color: 'var(--rarity-legend)' }
};

// Database Nomi (espandibile in futuro)
const FIRST_NAMES = ["Luca", "Mario", "Andrea", "Giovanni", "Paolo", "Marco", "Luigi", "Francesco", "Alessandro", "Davide", "Ciro", "Lorenzo"];
const LAST_NAMES = ["Rossi", "Bianchi", "Russo", "Ferrari", "Esposito", "Romano", "Gallo", "Costa", "Fontana", "Conti", "Ricci", "Marino"];

function randomInt(min, max) { 
    return Math.floor(Math.random() * (max - min + 1)) + min; 
}

function randomName() { 
    return `${FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)]}`; 
}

function determineRarity(overall) {
    for (const key in RARITIES) {
        if (overall >= RARITIES[key].min && overall <= RARITIES[key].max) return key;
    }
    return 'BRONZE';
}

// Generatore di un singolo giocatore
export function generatePlayer(pos, isStarter) {
    // La squadra iniziale avrà giocatori scarsi (50-70), quindi Bronzo e Argento
    const overall = randomInt(50, 70);
    const rarityKey = determineRarity(overall);
    
    return {
        id: Math.random().toString(36).substr(2, 9),
        name: randomName(),
        position: pos,
        overall: overall,
        rarity: RARITIES[rarityKey].name,
        color: RARITIES[rarityKey].color,
        isStarter: isStarter
    };
}

// Genera i 12 giocatori iniziali (7 titolari + 5 riserve)
export function generateInitialSquad() {
    return [
        // TITOLARI (Modulo 2-3-1 + POR)
        generatePlayer('POR', true),
        generatePlayer('DIF', true), generatePlayer('DIF', true),
        generatePlayer('CEN', true), generatePlayer('CEN', true), generatePlayer('CEN', true),
        generatePlayer('ATT', true),
        
        // RISERVE
        generatePlayer('POR', false),
        generatePlayer('DIF', false),
        generatePlayer('CEN', false),
        generatePlayer('CEN', false),
        generatePlayer('ATT', false)
    ];
}