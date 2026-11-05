import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlizzardError } from './blizzard-client.mjs';
import { refreshForever } from './refresh-forever.mjs';

const args = ['--allow-authenticated-blizzard', '--from-env', '--require-roster'];
const environment = {
    BLIZZARD_CLIENT_ID: 'synthetic-ci-client', BLIZZARD_CLIENT_SECRET: 'synthetic-ci-secret',
    BLIZZARD_REGION: 'eu', BLIZZARD_RULESET: 'pve', BLIZZARD_GUILD_ID: '42',
    BLIZZARD_GUILD_SLUG: 'test-guild', BLIZZARD_GUILD_NAME: 'Test Guild',
};
const member = { character: { id: 11, name: 'First', surname: 'Last', level: 10,
    playable_class: { id: 2 }, access_token: 'synthetic-remote-token' }, rank: 3 };
const clientFactory = () => ({ async get(path) {
    if (path === '/data/wow/guild/test-guild') return { id: 42, name: 'Test Guild' };
    if (path === '/data/wow/guild/test-guild/roster') return { guild: { id: 42 }, members: [member] };
    throw new Error('Unexpected fixture request');
} });

async function fixture(t) {
    const directory = await mkdtemp(join(tmpdir(), 'forever-ci-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await mkdir(join(directory, 'config'));
    await mkdir(join(directory, 'data'));
    await writeFile(join(directory, 'config/collection-policy.json'), JSON.stringify({
        detailedLevel: 60, detailsRefreshHours: 3, inactiveAfterDays: 14, inactiveRefreshHours: 168,
        maxCharactersPerRun: 40, blizzardRequestIntervalMs: 750, maxRetries: 2,
    }));
    await writeFile(join(directory, 'data/talents.json'), JSON.stringify({ schemaVersion: 1, classes: {} }));
    return directory;
}

test('CI collects from injected credentials without an env file and persists only public data', async t => {
    const directory = await fixture(t);
    const snapshot = await refreshForever({ args, environment, directory, clientFactory: options => {
        assert.equal(options.clientId, environment.BLIZZARD_CLIENT_ID);
        assert.equal(options.clientSecret, environment.BLIZZARD_CLIENT_SECRET);
        assert.equal(options.intervalMs, 750);
        assert.equal(options.maxRetries, 2);
        return clientFactory();
    } });
    assert.equal(snapshot.sources.blizzard.roster, 'available');
    assert.equal(snapshot.sources.warcraftLogs.status, 'unavailable');
    assert.equal(snapshot.players[0].name, 'First Last');
    assert.equal(snapshot.players[0].class, 'Paladin');
    await assert.rejects(readFile(join(directory, '.env.local')), { code: 'ENOENT' });
    const output = join(directory, 'site/public/data');
    for (const file of await readdir(output, { recursive: true })) {
        if (!file.endsWith('.json')) continue;
        const content = await readFile(join(output, file), 'utf8');
        for (const secret of [environment.BLIZZARD_CLIENT_ID, environment.BLIZZARD_CLIENT_SECRET, 'synthetic-remote-token'])
            assert.ok(!content.includes(secret));
    }
});

test('consent is checked before injected credentials can be read', async () => {
    const unreadable = new Proxy({}, { get() { throw new Error('Credentials were read without consent'); } });
    await assert.rejects(refreshForever({ args: ['--from-env'], environment: unreadable }), /Explicit consent/);
});

test('missing CI credentials never fall back to a local credential file', async t => {
    const directory = await fixture(t);
    await writeFile(join(directory, '.env.local'), Object.entries(environment).map(([key, value]) => `${key}=${value}`).join('\n'));
    await assert.rejects(refreshForever({ args, directory,
        environment: { ...environment, BLIZZARD_CLIENT_SECRET: '' },
        clientFactory() { throw new Error('Client must not be created'); },
    }), /credentials are required from the selected source/);
});

test('local collection uses its selected env file without reading injected credentials', async t => {
    const directory = await fixture(t);
    await writeFile(join(directory, '.env.local'), Object.entries(environment).map(([key, value]) => `${key}=${value}`).join('\n'));
    const unreadable = new Proxy({}, { get() { throw new Error('Unselected credential source was read'); } });
    const snapshot = await refreshForever({ args: ['--allow-authenticated-blizzard'], directory,
        environment: unreadable, clientFactory });
    assert.equal(snapshot.players.length, 1);
});

test('deployment requires a fresh roster and never replaces the saved snapshot on failure', async t => {
    for (const priorSnapshot of [false, true]) {
        await t.test(priorSnapshot ? 'existing live snapshot' : 'first deployment', async t => {
            const directory = await fixture(t);
            const path = join(directory, 'site/public/data/snapshot.json');
            if (priorSnapshot) await refreshForever({ args, environment, directory, clientFactory });
            const before = priorSnapshot ? await readFile(path, 'utf8') : undefined;
            await assert.rejects(refreshForever({ args, environment, directory,
                clientFactory: () => ({ async get() { throw new BlizzardError(404); } }),
            }), /fresh guild roster is required/);
            if (priorSnapshot) assert.equal(await readFile(path, 'utf8'), before);
            else await assert.rejects(readFile(path), { code: 'ENOENT' });
        });
    }
});

test('a fresh empty guild roster is a valid deployment', async t => {
    const directory = await fixture(t);
    const snapshot = await refreshForever({ args, environment, directory,
        clientFactory: () => ({ async get(path) {
            return path.endsWith('/roster') ? { guild: { id: 42 }, members: [] } : { id: 42, name: 'Test Guild' };
        } }),
    });
    assert.equal(snapshot.sources.blizzard.roster, 'available');
    assert.deepEqual(snapshot.players, []);
});
