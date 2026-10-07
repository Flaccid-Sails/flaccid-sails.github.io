import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCatalog, SOURCE_URL } from './talent-source.mjs';

export async function refreshTalents({ destination = resolve('data/talents.json'), fetchImpl = fetch, now } = {}) {
    let previous;
    try { previous = JSON.parse(await readFile(destination, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const headers = { Accept: 'application/json', 'User-Agent': 'Flaccid-Sails/3.0 (+https://github.com/Flaccid-Sails/flaccid-sails.github.io)' };
    if (previous?.etag) headers['If-None-Match'] = previous.etag;
    if (previous?.lastModified) headers['If-Modified-Since'] = previous.lastModified;
    let catalog;
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            response = await fetchImpl(SOURCE_URL, { headers, signal: AbortSignal.timeout(30_000) });
            if ((response.status === 429 || response.status >= 500) && attempt < 2) {
                await response.body?.cancel();
                await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
                continue;
            }
            break;
        } catch (error) {
            if (attempt === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
        }
    }
    if (response.status === 304 && previous) {
        catalog = { ...previous, checkedAt: now ?? new Date().toISOString() };
    } else {
        if (!response.ok) throw new Error(`Talent source returned HTTP ${response.status}. Saved data was not changed.`);
        const body = await response.text();
        if (Buffer.byteLength(body) > 10_000_000) throw new Error('Talent response exceeds 10 MB');
        catalog = createCatalog(JSON.parse(body), previous, now);
        if (response.headers.get('etag')) catalog.etag = response.headers.get('etag');
        if (response.headers.get('last-modified')) catalog.lastModified = response.headers.get('last-modified');
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(`${destination}.tmp`, JSON.stringify(catalog) + '\n');
    await rename(`${destination}.tmp`, destination);
    const count = Object.values(catalog.classes).flatMap(c => c.trees).reduce((sum, tree) => sum + tree.talents.length, 0);
    console.log(`Checked ${count} talents across ${Object.keys(catalog.classes).length} classes. ${previous?.contentHash === catalog.contentHash ? 'No talent changes.' : 'Updated talent snapshot.'}`);
    return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await refreshTalents();
}
