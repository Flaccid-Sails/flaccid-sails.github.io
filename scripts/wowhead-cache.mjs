import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Separate files allow different items to be updated independently, even if a
// later character or deployment fails. Only public Forever item data goes here.
export async function openWowheadCache(directory, profiles) {
    const root = join(directory, '.cache', 'wowhead-forever');
    await mkdir(root, { recursive: true });
    const cache = {
        async get(key) {
            try { return JSON.parse(await readFile(join(root, `${key}.json`), 'utf8')); }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
        },
        async set(key, value) {
            const file = join(root, `${key}.json`);
            const temporary = file + '.' + randomUUID() + '.tmp';
            try {
                await writeFile(temporary, JSON.stringify(value));
                await rename(temporary, file);
            } finally {
                await rm(temporary, { force: true });
            }
        },
    };

    // Older snapshots already contain successful Wowhead lookups. Use their
    // profile timestamps only to seed missing entries, never to renew a hit.
    const legacy = new Map();
    for (const profile of Object.values(profiles)) {
        if (!Number.isSafeInteger(profile.fetchedAt) || profile.fetchedAt <= 0) continue;
        for (const item of profile.equipment ?? []) {
            if (item.itemLevelSource !== 'wowhead' || !Number.isSafeInteger(item.id) || item.id <= 0 ||
                !Number.isSafeInteger(item.itemLevel) || item.itemLevel <= 0) continue;
            if (profile.fetchedAt > (legacy.get(item.id)?.checkedAt ?? 0))
                legacy.set(item.id, { level: item.itemLevel, checkedAt: profile.fetchedAt });
        }
    }
    for (const [id, entry] of legacy) {
        if (await cache.get(id) === undefined) await cache.set(id, entry);
    }
    return cache;
}
