// js/players.js

export const RARITIES = {
    BRONZE: { name: 'Bronzo', min: 50, max: 64, color: 'var(--rarity-bronze)' },
    SILVER: { name: 'Argento', min: 65, max: 74, color: 'var(--rarity-silver)' },
    GOLD: { name: 'Oro', min: 75, max: 80, color: 'var(--rarity-gold)' },
    RAREGOLD: { name: 'Oro Raro', min: 81, max: 84, color: 'var(--rarity-rare-gold)' },
    SUPERRARE: { name: 'Super Raro', min: 85, max: 88, color: 'var(--rarity-super-rare)' },
    EPIC: { name: 'Epico', min: 89, max: 92, color: 'var(--rarity-epic)' },
    LEGEND: { name: 'Leggenda', min: 93, max: 99, color: 'var(--rarity-legend)' }
};

const NATIONALITIES = ["🇮🇹 ITA", "🇪🇸 ESP", "🇬🇧 ENG", "🇩🇪 GER", "🇫🇷 FRA", "🇧🇷 BRA", "🇦🇷 ARG", "🇵🇹 POR", "🇳🇱 NED", "🇧🇪 NED"];
const FIRST_NAMES = ["Luca", "Mario", "Andrea", "Giovanni", "Paolo", "Marco", "Luigi", "Francesco", "Alessandro", "Davide", "Ciro", "Lorenzo", "Diego", "Carlos", "Pablo", "Kevin", "Luis"];
const LAST_NAMES = ["Rossi", "Bianchi", "Russo", "Ferrari", "Esposito", "Romano", "Gallo", "Costa", "Fontana", "Silva", "Santos", "Gomez", "Lopez", "Muller", "Dubois"];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomName() { return `${FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)]}`; }

function determineRarity(overall) {
    for (const key in RARITIES) { if (overall >= RARITIES[key].min && overall <= RARITIES[key].max) return key; }
    return 'BRONZE';
}

// Calcolo del prezzo del cartellino in base alla forza
function calculateValue(overall) {
    if(overall < 60) return randomInt(100, 400);
    if(overall < 70) return randomInt(500, 1500);
    if(overall < 80) return randomInt(2000, 6000);
    if(overall < 85) return randomInt(8000, 25000);
    if(overall < 90) return randomInt(30000, 80000);
    return randomInt(100000, 500000);
}

export function generatePlayer(pos, isStarter, forcedRarity = null) {
    let overall;
    if (forcedRarity === 'LEGEND') overall = randomInt(93, 99);
    else if (forcedRarity === 'EPIC') overall = randomInt(89, 92);
    else if (forcedRarity === 'SUPERRARE') overall = randomInt(85, 88);
    else if (forcedRarity === 'RAREGOLD') overall = randomInt(81, 84);
    else if (forcedRarity === 'GOLD') overall = randomInt(75, 80);
    else if (forcedRarity === 'SILVER') overall = randomInt(65, 74);
    else if (forcedRarity === 'BRONZE') overall = randomInt(50, 64);
    else overall = randomInt(50, 70); // Default Div 3
    
    const rarityKey = determineRarity(overall);
    const nationality = NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)];
    const value = calculateValue(overall);

    return {
        id: Math.random().toString(36).substr(2, 9),
        name: randomName(),
        nationality: nationality,
        position: pos,
        overall: overall,
        rarity: RARITIES[rarityKey].name,
        color: RARITIES[rarityKey].color,
        isStarter: isStarter,
        value: value
    };
}

export function generateInitialSquad() {
    return [
        generatePlayer('POR', true, 'BRONZE'),
        generatePlayer('DIF', true, 'SILVER'), generatePlayer('DIF', true, 'BRONZE'),
        generatePlayer('CEN', true, 'BRONZE'), generatePlayer('CEN', true, 'BRONZE'), generatePlayer('CEN', true, 'SILVER'),
        generatePlayer('ATT', true, 'BRONZE'),
        
        generatePlayer('POR', false, 'BRONZE'), generatePlayer('DIF', false, 'BRONZE'),
        generatePlayer('CEN', false, 'BRONZE'), generatePlayer('CEN', false, 'BRONZE'), generatePlayer('ATT', false, 'BRONZE')
    ];
}