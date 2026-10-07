import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createDemoTalentBuild } from './demo-talents.mjs';
import { summarizeReports } from './report-summary.mjs';

const catalog = JSON.parse(await readFile('data/talents.json', 'utf8'));
const output = resolve('site/public/data');
await rm(output, { recursive: true, force: true });
async function writeDataset(directory, data) {
    const contents = JSON.stringify(data);
    const file = `${directory}/${createHash('sha256').update(contents).digest('hex')}.json`;
    await mkdir(`${output}/${directory}`, { recursive: true });
    await writeFile(`${output}/${file}`, contents);
    return file;
}
const epoch = Date.parse('2026-10-07T12:00:00Z');
const classes = Object.keys(catalog.classes);
const names = ['Saltbeard', 'Dawnwatch', 'Reefrunner', 'Blackwake', 'Tidelight', 'Stormcall', 'Frostsail', 'Duskweaver', 'Wildgrove', 'Ironwake', 'Sunward', 'Gullwatch', 'Nightwake', 'Pearlkeeper', 'Wavecaller', 'Starwake', 'Ashbinder', 'Oakheart', 'Deckhand', 'Harborlight', 'Littlefin', 'Newtide', 'Seabreeze', 'Sprout'];
const players = names.map((name, i) => ({
    name, realm: 'Preview', class: classes[i % classes.length], level: i < 18 ? 60 : 16 + (i - 18) * 7,
    rank: i === 0 ? 0 : i < 4 ? 2 : i < 18 ? 4 : 7,
    equippedItemLevel: i < 18 ? 60 + i % 12 : -1, itemLevel: i < 18 ? 63 + i % 12 : -1,
    achievementPoints: 0, lastLogin: epoch - i * 3_600_000,
    image: `icons/${catalog.classes[classes[i % classes.length]].icon}.jpg`,
}));
const characterBuilds = new Map();
for (const [index, player] of players.entries()) {
    const primaryTree = Math.floor(index / classes.length) % 3;
    const builds = [createDemoTalentBuild(catalog.classes[player.class], player.level, primaryTree)];
    if (player.level === 60) {
        const secondary = createDemoTalentBuild(catalog.classes[player.class], player.level, (primaryTree + 1) % 3);
        builds.push({ ...secondary, name: 'Secondary' });
    }
    characterBuilds.set(`${player.realm}/${player.name}`, builds);
}
const bosses = [{ id: -1, name: 'The Reef Guardian (demo)' }, { id: -2, name: 'Admiral Blackwake (demo)' }, { id: -3, name: 'The Drowned King (demo)' }];
const zones = [{ id: -1, name: 'Demo raid', bosses }];
const logs = Object.fromEntries(players.filter(p => p.level === 60).map((p, i) => [`preview-${p.name}`, {
    dps: 55 + i * 2, healer: i % 3 === 1 ? 65 + i : undefined,
    tank: i % 9 === 0 ? 85 + i / 2 : undefined, rawDps: 60 + i * 2,
    rawHps: i % 3 === 1 ? 68 + i : undefined, difficulty: 3, killedBosses: 3,
    bosses: bosses.map(b => ({ bossId: b.id, difficulty: 3, dps: 60 + i * 2, healer: i % 3 === 1 ? 65 + i : undefined })),
}]));
const reportPlayers = players.filter(p => p.level === 60);
const reports = [0, 1, 2].map(i => ({
    code: `demo-${i}`, title: ['First voyage (demo)', 'A night at sea (demo)', 'Crew practice (demo)'][i],
    endTime: epoch - i * 86_400_000, zoneId: -1,
    bosses: bosses.map(b => ({
        id: b.id, difficulty: 3,
        dps: reportPlayers.filter((_, n) => n % 3 !== 1 && n % 9 !== 0).map((p, n) => ({ name: p.name, realm: p.realm, log: 65 + n * 2, dps: 600 + n * 65, hps: 10 })),
        tanks: reportPlayers.filter((_, n) => n % 9 === 0).map(p => ({ name: p.name, realm: p.realm, log: 85, dps: 420, hps: 10 })),
        healers: reportPlayers.filter((_, n) => n % 3 === 1).map((p, n) => ({ name: p.name, realm: p.realm, log: 78 + n * 2, dps: 80, hps: 850 + n * 50 })),
    })),
}));
const slots = ['HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET', 'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2', 'MAIN_HAND', 'OFF_HAND'];
const icons = ['inv_helmet_03', 'inv_jewelry_necklace_01', 'inv_shoulder_01', 'inv_misc_cape_01', 'inv_chest_plate01', 'inv_bracer_01', 'inv_gauntlets_01', 'inv_belt_01', 'inv_pants_01', 'inv_boots_01', 'inv_jewelry_ring_01', 'inv_jewelry_ring_02', 'inv_misc_gem_pearl_01', 'inv_misc_gem_pearl_02', 'inv_sword_04', 'inv_shield_04'];
const characterFiles = {};
for (const [i, player] of players.entries()) {
    const profile = { talentBuilds: characterBuilds.get(`${player.realm}/${player.name}`) };
    if (player.level >= 60) {
        profile.statistics = {
            health: 4200 + i * 70,
            power: ['Warrior', 'Rogue'].includes(player.class) ? 100 : 3100,
            powerType: player.class === 'Warrior' ? 'Rage' : player.class === 'Rogue' ? 'Energy' : 'Mana',
            movementSpeed: 100, strength: 180, agility: 140,
            intellect: 210, stamina: 220, meleeCrit: 12, meleeHaste: 0, mastery: 0, bonusArmor: 0,
            attackPower: 450, mainHandDamageMin: 100, mainHandDamageMax: 180, mainHandSpeed: 2.6,
            mainHandDps: 54, offHandDamageMin: 0, offHandDamageMax: 0, offHandSpeed: 0, offHandDps: 0,
            spellPower: 320, spellPenetration: 0, spellCrit: 14, manaRegen: 80, manaRegenCombat: 30,
            armor: 1700, dodge: 6, parry: 5, block: 5, rangedCrit: 10, rangedHaste: 0, spellHaste: 0, spirit: 130,
        };
        profile.equipment = slots.map((slot, n) => ({
            id: -(n + 1), name: `Sailor's ${slot.toLowerCase().replaceAll('_', ' ')} (demo)`, slot,
            quality: n % 3 === 0 ? 'EPIC' : 'RARE', armor: 120, itemClass: 'Armor', itemSubclass: 'Demo equipment',
            inventoryType: slot, stats: ['+15 Stamina', '+12 Intellect'], bonusStats: [],
            requirements: ['Requires Level 60'], spells: [], sockets: [], itemLevel: player.equippedItemLevel,
            media: `icons/${icons[n]}.jpg`,
        }));
    }
    characterFiles[`${player.realm}/${player.name}`] = await writeDataset('characters', profile);
}
const reportIndex = [];
for (const report of reports) {
    reportIndex.push({
        code: report.code, title: report.title, endTime: report.endTime, zoneId: report.zoneId,
        bosses: report.bosses.map(boss => ({ id: boss.id, difficulty: boss.difficulty })),
        file: await writeDataset('reports', report),
    });
}
const snapshot = {
    schemaVersion: 2, mode: 'demo', generatedAt: catalog.checkedAt,
    parameters: { lastUpdate: epoch / 1000, lastLogsUpdate: epoch / 1000, maxLevel: 60, minimumRaidItemLevel: 60 },
    players, logs, zones,
    characterIndexFile: await writeDataset('indexes', characterFiles),
    reportIndexFile: await writeDataset('indexes', reportIndex),
    dashboardFile: await writeDataset('indexes', summarizeReports(reports, zones)),
    talentCatalogFile: await writeDataset('catalog', catalog),
};
await writeFile(`${output}/snapshot.json`, JSON.stringify(snapshot));
console.log(`Generated ${players.length} demo players, ${reports.length} demo reports, and ${Object.keys(characterFiles).length} profiles.`);
