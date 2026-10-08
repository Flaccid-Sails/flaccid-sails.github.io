import { readFile, mkdir, access, writeFile, rename, copyFile } from 'node:fs/promises';
import sharp from 'sharp';

const catalog = JSON.parse(await readFile('data/talents.json', 'utf8'));
const icons = new Set(['inv_helmet_03', 'inv_jewelry_necklace_01', 'inv_shoulder_01', 'inv_misc_cape_01', 'inv_chest_plate01', 'inv_bracer_01', 'inv_gauntlets_01', 'inv_belt_01', 'inv_pants_01', 'inv_boots_01', 'inv_jewelry_ring_01', 'inv_jewelry_ring_02', 'inv_misc_gem_pearl_01', 'inv_misc_gem_pearl_02', 'inv_sword_04', 'inv_shield_04']);
for (const c of Object.values(catalog.classes)) {
    icons.add(c.icon);
    for (const tree of c.trees) { icons.add(tree.icon); for (const talent of tree.talents) icons.add(talent.icon); }
}
await mkdir('site/public/icons', { recursive: true });
const queue = [...icons];
let downloaded = 0;
async function worker() {
    while (queue.length) {
        const icon = queue.shift();
        if (!/^[a-z0-9_]+$/i.test(icon)) throw new Error('Invalid icon name in talent source');
        const file = `site/public/icons/${icon}.webp`;
        try { await access(file); continue; } catch {}
        const response = await fetch(`https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`, { signal: AbortSignal.timeout(30_000) });
        if (response.status === 404) {
            console.warn(`Icon ${icon} is unavailable; using the local WoW icon.`);
            await copyFile('site/public/assets/wow-icon.webp', file);
            continue;
        }
        if (!response.ok) throw new Error(`Icon ${icon}: HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 100_000 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
            throw new Error(`Invalid JPEG for ${icon}`);
        await writeFile(`${file}.tmp`, await sharp(bytes).webp({ quality: 80 }).toBuffer());
        await rename(`${file}.tmp`, file);
        downloaded++;
    }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`Cached ${icons.size} icons; downloaded ${downloaded} new files.`);
