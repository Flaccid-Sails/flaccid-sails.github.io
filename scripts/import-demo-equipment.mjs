import { DatabaseSync } from 'node:sqlite';
import { writeFile } from 'node:fs/promises';

if (!process.argv[2]) throw new Error('Usage: node scripts/import-demo-equipment.mjs /path/to/tortoise.sqlite');
const db = new DatabaseSync(process.argv[2], { readOnly: true });
const sets = {
    Warrior: ['Might', [18348, 17066], 4], Paladin: ['Lawbringer', [18822], 1],
    Hunter: ['Giantstalker', [18713], 3], Rogue: ['Nightslayer', [18816, 18805], 4],
    Priest: ['Prophecy', [18608], 1], Shaman: ['Earthfury', [17105, 17066], 2],
    Mage: ['Arcanist', [18842], 7], Warlock: ['Felheart', [18842], 5], Druid: ['Cenarion', [18842], 4],
};
const slots = {
    1: 'HEAD', 3: 'SHOULDER', 5: 'CHEST', 6: 'WAIST', 7: 'LEGS', 8: 'FEET',
    9: 'WRIST', 10: 'HANDS', 13: 'MAIN_HAND', 14: 'OFF_HAND', 15: 'RANGED', 16: 'BACK',
    17: 'MAIN_HAND', 20: 'CHEST', 21: 'MAIN_HAND'
};
const statNames = { 3: 'Agility', 4: 'Strength', 5: 'Intellect', 6: 'Spirit', 7: 'Stamina' };
const query = db.prepare('SELECT i.*, d.icon FROM items i JOIN item_display_info d ON d.ID = i.display_id WHERE i.entry = ?');
const display = db.prepare('SELECT * FROM item_appearance WHERE display_id = ?');
const outfits = {};
for (const [name, [stem, weapons, race]] of Object.entries(sets)) {
    const armor = db.prepare('SELECT entry FROM items WHERE name LIKE ? AND entry BETWEEN 16795 AND 16868 AND quality = 4').all(`%${stem}%`);
    if (armor.length !== 8) throw new Error(`Expected eight armor pieces for ${name}`);
    const equipment = [...armor.map(row => row.entry), 13340, ...weapons].map(id => {
        const item = query.get(id);
        const row = display.get(item.display_id);
        if (!row || !slots[item.inventory_type]) throw new Error(`Appearance missing for ${id}`);
        const appearance = Object.fromEntries(Object.entries(row).filter(([key, value]) => value !== null && value !== '' && !['model_dir', 'item_visual'].includes(key)));
        appearance.inv = item.inventory_type;
        const stats = [];
        for (let n = 1; n <= 10; n++) {
            if (item[`stat_value${n}`] && statNames[item[`stat_type${n}`]]) stats.push(`+${item[`stat_value${n}`]} ${statNames[item[`stat_type${n}`]]}`);
        }
        const slot = name === 'Rogue' && id === weapons[1] ? 'OFF_HAND' : slots[item.inventory_type];
        return {
            id, name: item.name, slot, quality: item.quality === 4 ? 'EPIC' : 'RARE',
            armor: item.armor, itemClass: item.class === 2 ? 'Weapon' : 'Armor',
            itemSubclass: item.class === 4 ? ['Miscellaneous', 'Cloth', 'Leather', 'Mail', 'Plate', '', 'Shield'][item.subclass] : 'Weapon',
            inventoryType: slot, stats, bonusStats: [], requirements: [`Requires Level ${item.required_level}`],
            spells: [], sockets: [], itemLevel: item.item_level, media: `icons/${item.icon.toLowerCase()}.webp`, appearance
        };
    });
    outfits[name] = { appearance: { race, sex: 'f', skin: 0, face: 0, hair: 0, hairColor: 0, facialHair: 0 }, equipment };
}
db.close();
await writeFile('data/demo-equipment.json', JSON.stringify({
    source: 'https://github.com/Xian55/tortoise-db-viewer',
    dataset: 'https://cdn.tortoiseclothing.org/data/tortoise.sqlite',
    modelVersion: '896ce44982', outfits,
}, null, 2) + '\n');
