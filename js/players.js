// js/players.js
export const RARITIES = {
    BRONZE: { name: 'Bronzo', min: 40, max: 64, color: 'var(--rarity-bronze)' },
    SILVER: { name: 'Argento', min: 65, max: 74, color: 'var(--rarity-silver)' },
    GOLD: { name: 'Oro', min: 75, max: 80, color: 'var(--rarity-gold)' },
    RAREGOLD: { name: 'Oro Raro', min: 81, max: 84, color: 'var(--rarity-rare-gold)' },
    SUPERRARE: { name: 'Super Raro', min: 85, max: 88, color: 'var(--rarity-super-rare)' },
    EPIC: { name: 'Epico', min: 89, max: 92, color: 'var(--rarity-epic)' },
    LEGEND: { name: 'Leggenda', min: 93, max: 99, color: 'var(--rarity-legend)' }
};

const NATIONALITIES = ["🇮🇹 ITA", "🇪🇸 ESP", "🇬🇧 ENG", "🇩🇪 GER", "🇫🇷 FRA", "🇧🇷 BRA", "🇦🇷 ARG", "🇵🇹 POR", "🇳🇱 NED", "🇧🇪 BEL", "🇺🇾 URU", "🇨🇴 COL"];
const FIRST_NAMES = ["Luca", "Mario", "Andrea", "Giovanni", "Paolo", "Marco", "Luigi", "Francesco", "Alessandro", "Davide", "Ciro", "Lorenzo", "Diego", "Carlos", "Pablo", "Kevin", "Luis", "Leo"];
const LAST_NAMES = ["Rossi", "Bianchi", "Russo", "Ferrari", "Esposito", "Romano", "Gallo", "Costa", "Fontana", "Silva", "Santos", "Gomez", "Lopez", "Muller", "Dubois", "Messi"];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
export function randomName() { return `${FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)]}`; }

function getRarityKey(overall) {
    for (const key in RARITIES) { if (overall >= RARITIES[key].min && overall <= RARITIES[key].max) return key; }
    return 'BRONZE';
}

export function calculateValue(overall) {
    if(overall < 60) return randomInt(50, 300);
    if(overall < 70) return randomInt(400, 1500);
    if(overall < 80) return randomInt(2000, 6000);
    if(overall < 85) return randomInt(8000, 25000);
    if(overall < 90) return randomInt(30000, 80000);
    return randomInt(100000, 500000);
}

export function generateRandomNameByNation(natKey) { return randomName(); }

export function generatePlayer(pos, isStarter, forcedRarity = null, isRegen = false) {
    let overall;
    if (forcedRarity === 'LEGEND') overall = randomInt(93, 99);
    else if (forcedRarity === 'EPIC') overall = randomInt(89, 92);
    else if (forcedRarity === 'SUPERRARE') overall = randomInt(85, 88);
    else if (forcedRarity === 'RAREGOLD') overall = randomInt(81, 84);
    else if (forcedRarity === 'GOLD') overall = randomInt(75, 80);
    else if (forcedRarity === 'SILVER') overall = randomInt(65, 74);
    else if (forcedRarity === 'BRONZE') overall = randomInt(50, 64);
    else overall = randomInt(50, 70);
    
    const rarityKey = getRarityKey(overall);
    const nationality = NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)];
    const age = isRegen ? randomInt(17, 19) : randomInt(18, 34);

    let secondaryPositions = [];
    if (overall >= 74) {
        if (pos === 'DIF' && Math.random() > 0.5) secondaryPositions.push('CEN');
        if (pos === 'CEN') secondaryPositions.push(Math.random() > 0.5 ? 'DIF' : 'ATT');
        if (pos === 'ATT' && Math.random() > 0.5) secondaryPositions.push('CEN');
    }

    return {
        id: Math.random().toString(36).substr(2, 9),
        name: randomName(),
        nationality: nationality,
        nationKey: "ITA",
        age: age,
        position: pos,
        secondaryPositions: secondaryPositions,
        overall: overall,
        rarity: RARITIES[rarityKey].name,
        color: RARITIES[rarityKey].color,
        isStarter: isStarter,
        value: calculateValue(overall),
        stats: { appearances: 0, goals: 0, assists: 0, cleanSheets: 0 },
        status: { injured: 0, suspended: 0, yellowCards: 0 },
        trainingBoost: 0 // NUOVO: Traccia l'allenamento pagato dal player
    };
}

export function generateInitialSquad() {
    return [
        { ...generatePlayer('POR', true, 'BRONZE'), slotIndex: 0 },
        { ...generatePlayer('DIF', true, 'SILVER'), slotIndex: 1 },
        { ...generatePlayer('DIF', true, 'BRONZE'), slotIndex: 2 },
        { ...generatePlayer('CEN', true, 'BRONZE'), slotIndex: 3 },
        { ...generatePlayer('CEN', true, 'BRONZE'), slotIndex: 4 },
        { ...generatePlayer('CEN', true, 'SILVER'), slotIndex: 5 },
        { ...generatePlayer('ATT', true, 'BRONZE'), slotIndex: 6 },
        generatePlayer('POR', false, 'BRONZE'), generatePlayer('DIF', false, 'BRONZE'),
        generatePlayer('CEN', false, 'BRONZE'), generatePlayer('CEN', false, 'BRONZE'), generatePlayer('ATT', false, 'BRONZE')
    ];
}

export function processEndOfSeason(player) {
    player.age += 1;
    if (player.age >= 40 || (player.age >= 35 && Math.random() > 0.4)) return { retired: true, growth: 0 };

    let growth = 0;
    // Crescita Base per Età
    if (player.age <= 23) growth = randomInt(1, 4);
    else if (player.age > 23 && player.age <= 28) growth = randomInt(0, 2);
    else if (player.age > 28 && player.age <= 32) growth = randomInt(-1, 1);
    else growth = randomInt(-3, -1);

    // Crescita per Prestazioni
    if (player.stats.appearances > 10) growth += 1;
    if (player.stats.goals > 5) growth += 1;

    // NUOVO: Aggiunta del Boost Allenamento pagato durante l'anno
    if (player.trainingBoost && player.trainingBoost > 0) {
        growth += player.trainingBoost;
        player.trainingBoost = 0; // Reset a fine stagione
    }

    player.overall += growth;
    if (player.overall > 99) player.overall = 99;
    if (player.overall < 40) player.overall = 40;

    const newRarityKey = getRarityKey(player.overall);
    player.rarity = RARITIES[newRarityKey].name;
    player.color = RARITIES[newRarityKey].color;
    player.value = calculateValue(player.overall);
    
    player.stats = { appearances: 0, goals: 0, assists: 0, cleanSheets: 0 };
    if(!player.status) player.status = { injured: 0, suspended: 0, yellowCards: 0 };
    player.status.injured = 0; player.status.suspended = 0; player.status.yellowCards = 0;

    return { retired: false, growth };
}