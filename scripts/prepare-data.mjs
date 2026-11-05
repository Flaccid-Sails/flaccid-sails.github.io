import { readFile } from 'node:fs/promises';

try {
    const snapshot = JSON.parse(await readFile('site/public/data/snapshot.json', 'utf8'));
    if (snapshot.schemaVersion !== 2 || !['demo', 'live'].includes(snapshot.mode))
        throw new Error('Unsupported guild snapshot.');
    console.log(`Using the existing ${snapshot.mode} snapshot; no API requests made.`);
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await import('./generate-demo.mjs');
}
