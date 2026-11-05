import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBlizzardClient } from './blizzard-client.mjs';
import { collectForever, sameGuild } from './forever-data.mjs';

export async function publishForever(data, catalog, output) {
    async function dataset(directory, value) {
        const contents = JSON.stringify(value);
        const filename = `${directory}/${createHash('sha256').update(contents).digest('hex')}.json`;
        await mkdir(resolve(output, directory), { recursive: true });
        await writeFile(resolve(output, filename), contents);
        return filename;
    }
    const characterIndex = {};
    for (const [key, profile] of Object.entries(data.profiles)) characterIndex[key] = await dataset('characters', profile);
    const snapshot = {
        schemaVersion: 2, mode: 'live', generatedAt: new Date().toISOString(),
        guild: data.guild, players: data.players, parameters: data.parameters, sources: data.sources,
        logs: {}, zones: [],
        characterIndexFile: await dataset('indexes', characterIndex),
        reportIndexFile: await dataset('indexes', []), dashboardFile: await dataset('indexes', []),
        talentCatalogFile: await dataset('catalog', catalog),
    };
    // Publish the pointer last. A failed fetch or write leaves the previous snapshot usable.
    const temporary = resolve(output, 'snapshot.next.json');
    await writeFile(temporary, JSON.stringify(snapshot));
    await rename(temporary, resolve(output, 'snapshot.json'));
    return snapshot;
}

export async function refreshForever({ args = process.argv.slice(2), environment = process.env,
    directory = process.cwd(), clientFactory = createBlizzardClient } = {}) {
    // Building and importing these modules never reads credentials or authenticates.
    // The caller must obtain human consent before invoking this explicit command.
    if (!args.includes('--allow-authenticated-blizzard'))
        throw new Error('Explicit consent is required. Run with --allow-authenticated-blizzard only after authorization.');
    // CI injects the two approved Actions secrets into this step's environment.
    // Never write them to a file or fall back to a different credential source.
    const env = args.includes('--from-env') ? environment : parseEnv(await readFile(resolve(directory, '.env.local'), 'utf8'));
    const configuration = {
        region: env.BLIZZARD_REGION ?? 'eu', guildId: Number(env.BLIZZARD_GUILD_ID),
        guildSlug: env.BLIZZARD_GUILD_SLUG, guildName: env.BLIZZARD_GUILD_NAME ?? 'Flaccid Sails',
        ruleset: env.BLIZZARD_RULESET?.toLowerCase() === 'pvp' ? 'PvP' : 'PvE',
    };
    if (!configuration.guildSlug || !/^[\p{L}\p{N}-]+$/u.test(configuration.guildSlug) ||
        !Number.isSafeInteger(configuration.guildId) || configuration.guildId <= 0)
        throw new Error('Configure BLIZZARD_GUILD_ID and BLIZZARD_GUILD_SLUG first.');
    if (!env.BLIZZARD_CLIENT_ID || !env.BLIZZARD_CLIENT_SECRET)
        throw new Error('Blizzard client credentials are required from the selected source.');
    const output = resolve(directory, 'site/public/data');
    let previous;
    try { previous = JSON.parse(await readFile(resolve(output, 'snapshot.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('The current snapshot could not be read.'); }
    const profiles = {};
    if (sameGuild(previous, configuration)) {
        const validIndex = /^indexes\/[a-f0-9]{64}\.json$/;
        if (!validIndex.test(previous.characterIndexFile)) throw new Error('Invalid saved character index.');
        const index = JSON.parse(await readFile(resolve(output, previous.characterIndexFile), 'utf8'));
        for (const [key, file] of Object.entries(index)) {
            if (!/^characters\/[a-f0-9]{64}\.json$/.test(file)) throw new Error('Invalid saved character file.');
            profiles[key] = JSON.parse(await readFile(resolve(output, file), 'utf8'));
        }
    }
    const policy = JSON.parse(await readFile(resolve(directory, 'config/collection-policy.json'), 'utf8'));
    const catalog = JSON.parse(await readFile(resolve(directory, 'data/talents.json'), 'utf8'));
    const client = clientFactory({ clientId: env.BLIZZARD_CLIENT_ID,
        clientSecret: env.BLIZZARD_CLIENT_SECRET, region: configuration.region,
        intervalMs: policy.blizzardRequestIntervalMs, maxRetries: policy.maxRetries });
    const data = await collectForever({ client, configuration, policy, previous, profiles });
    if (args.includes('--require-roster') && data.sources.blizzard.roster !== 'available')
        throw new Error('A fresh guild roster is required for deployment. The previous snapshot was retained.');
    const snapshot = await publishForever(data, catalog, output);
    console.log(`Saved Blizzard-only snapshot: ${snapshot.players.length} players; guild roster ${snapshot.sources.blizzard.roster}; Warcraft Logs not connected.`);
    return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    refreshForever().catch(() => {
        // Do not print arbitrary exceptions from filesystem, fetch, or remote JSON.
        console.error('Forever refresh failed. Check consent, configuration, and Blizzard availability. The previous snapshot was retained.');
        process.exitCode = 1;
    });
}
