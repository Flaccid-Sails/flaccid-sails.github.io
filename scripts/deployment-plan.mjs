import { createHash } from 'node:crypto';
import { appendFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const digest = value => createHash('sha256').update(value).digest('hex');
const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(
        Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
};
const omit = (value, keys) => Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => !keys.includes(key)));

export function guildContentHash(data, catalog) {
    // Keep collection timestamps in the snapshot/cache for refresh scheduling,
    // but do not publish the whole site just to advance those timestamps.
    const content = {
        ...data,
        parameters: {
            ...omit(data.parameters, ['lastUpdate', 'lastLogsUpdate']),
            lastUpdate: Boolean(data.parameters?.lastUpdate),
            lastLogsUpdate: Boolean(data.parameters?.lastLogsUpdate),
        },
        sources: { ...data.sources, blizzard: omit(data.sources?.blizzard, ['checkedAt']) },
        profiles: Object.fromEntries(Object.entries(data.profiles).map(([key, profile]) => [key, omit(profile, ['fetchedAt'])])),
        catalog: omit(catalog, ['checkedAt', 'changedAt', 'sourceGeneratedAt', 'contentHash', 'etag', 'lastModified']),
    };
    return digest(JSON.stringify(canonical(content)));
}

export async function planDeployment({ directory = process.cwd(), basePath = '/', artworkBaseUrl = '', force = false } = {}) {
    const snapshot = JSON.parse(await readFile(resolve(directory, 'site/public/data/snapshot.json'), 'utf8'));
    if (snapshot.schemaVersion !== 2 || snapshot.mode !== 'live' || !/^[a-f0-9]{64}$/.test(snapshot.contentHash))
        throw new Error('A freshly collected live snapshot with a content hash is required.');

    const files = ['package.json', 'package-lock.json', 'site/index.html', 'site/package.json',
        'site/tsconfig.json', 'site/vite.config.ts', 'scripts/prepare-data.mjs',
        'scripts/build-image-sw.mjs', 'scripts/refresh-forever.mjs', 'scripts/deployment-plan.mjs'];
    async function collect(path) {
        for (const entry of await readdir(resolve(directory, path), { withFileTypes: true })) {
            const file = `${path}/${entry.name}`;
            // Only inspect public assets and frontend source, never env files or
            // generated data history, dependencies, build outputs, or credentials.
            if (entry.name.startsWith('.') || file === 'site/public/data') continue;
            if (entry.isDirectory()) await collect(file);
            else if (entry.isFile()) files.push(file);
            else throw new Error(`Unsupported build input: ${file}`);
        }
    }
    await collect('site/src');
    await collect('site/public');
    const inputs = [];
    for (const file of files.sort()) inputs.push([file, digest(await readFile(resolve(directory, file)))]);
    const fingerprint = digest(JSON.stringify({ version: 1, data: snapshot.contentHash,
        basePath, artworkBaseUrl, inputs }));
    let deployed;
    try { deployed = (await readFile(resolve(directory, '.cache/site-deployment/fingerprint'), 'utf8')).trim(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const deploy = force || fingerprint !== deployed;
    const reason = force ? 'Deployment was requested manually.'
        : !deployed ? 'No successful deployment baseline is cached.'
            : deploy ? 'Site files or guild content changed since the last successful deployment.'
                : 'Site files and guild content are unchanged; skipping build, upload, and deployment.';
    // This only compares state. The workflow saves the fingerprint AFTER Pages
    // confirms deployment, so a failed deployment remains eligible for retry.
    return { fingerprint, deploy, reason };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const result = await planDeployment({ basePath: process.env.SITE_BASE_PATH || '/',
        artworkBaseUrl: process.env.ARTWORK_BASE_URL || '', force: process.env.FORCE_DEPLOY === 'true' });
    console.log(result.reason);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,
        `fingerprint=${result.fingerprint}\ndeploy=${result.deploy}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${result.reason}\n`);
}
