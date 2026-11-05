import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createBlizzardClient, BlizzardError } from './blizzard-client.mjs';
import { collectForever, mapPlayer, mapEquipment, mapStatistics } from './forever-data.mjs';
import { publishForever } from './refresh-forever.mjs';

const configuration = { region: 'eu', ruleset: 'PvE', guildId: 42, guildSlug: 'test-guild', guildName: 'Test Guild' };
const policy = { detailedLevel: 60, maxCharactersPerRun: 2, detailsRefreshHours: 6, inactiveAfterDays: 14, inactiveRefreshHours: 168 };
const summary = { id: 11, name: 'First', surname: 'Last', level: 60,
    character_class: { name: 'Paladin' }, guild: { id: 42 }, last_login_timestamp: Date.now(),
    access_token: 'fixture-token', client_secret: 'fixture-secret' };
const roster = { guild: { id: 42 }, members: [{ character: summary, rank: 3 }] };
const equipment = { equipped_items: [{ item: { id: 5 }, name: 'Test sword', slot: { type: 'MAIN_HAND' },
    quality: { type: 'COMMON' }, level: { value: 9 }, weapon: { damage: { display_string: '10 - 16 Damage' } } }] };
const statistics = { health: 230, strength: { base: 30, effective: 31 }, melee_crit: { value: 4.616 }, power_type: { name: 'Mana' } };

function mockClient(routes) {
    const calls = [];
    return { calls, async get(path) {
        calls.push(path);
        if (!(path in routes)) throw new BlizzardError(404);
        if (routes[path] instanceof Error) throw routes[path];
        return structuredClone(routes[path]);
    } };
}

test('Blizzard-only collection uses realmless guild and character routes and publishes no log dependency', async () => {
    const client = mockClient({
        '/data/wow/guild/test-guild': { id: 42, name: 'Test Guild' },
        '/data/wow/guild/test-guild/roster': roster,
        '/profile/wow/character/first-last': summary,
        '/profile/wow/character/first-last/equipment': equipment,
        '/profile/wow/character/first-last/statistics': statistics,
    });
    const data = await collectForever({ client, configuration, policy });
    assert.equal(data.players[0].name, 'First Last');
    assert.equal(data.players[0].realm, 'PvE');
    assert.equal(data.players[0].equipmentAvailable, true);
    assert.equal(data.players[0].talentsAvailable, false);
    assert.equal(data.sources.blizzard.roster, 'available');
    assert.equal(data.sources.warcraftLogs.status, 'unavailable');
    assert.equal(data.profiles['PvE/First Last'].statistics.strength, 31);
    assert.ok(!JSON.stringify(data).includes('fixture-token'));
    assert.ok(!JSON.stringify(data).includes('fixture-secret'));
    assert.ok(client.calls.every(path => path.startsWith('/data/wow/guild/') || path.startsWith('/profile/wow/character/')));
    const directory = await mkdtemp(join(tmpdir(), 'forever-publish-'));
    try {
        const snapshot = await publishForever(data, { schemaVersion: 1, classes: {} }, directory);
        const index = JSON.parse(await readFile(join(directory, snapshot.reportIndexFile), 'utf8'));
        assert.deepEqual(index, []);
        assert.deepEqual(snapshot.logs, {});
        assert.deepEqual(snapshot.zones, []);
        assert.equal(snapshot.mode, 'live');
        assert.equal(JSON.parse(await readFile(join(directory, 'snapshot.json'), 'utf8')).guild.id, 42);
    } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a missing roster is unavailable, never demo players or evidence of an empty guild', async () => {
    const client = mockClient({});
    const previous = { mode: 'demo', players: [{ name: 'Demo player' }] };
    const data = await collectForever({ client, configuration, policy, previous });
    assert.deepEqual(data.players, []);
    assert.equal(data.sources.blizzard.roster, 'unavailable');
    assert.equal(data.parameters.lastUpdate, undefined);
    assert.deepEqual(client.calls, ['/data/wow/guild/test-guild', '/data/wow/guild/test-guild/roster']);
});

test('a temporarily unavailable guild retains the matching live roster and details', async () => {
    const player = mapPlayer({ ...summary, level: 10 });
    const previous = { mode: 'live', guild: { id: 42, region: 'eu', ruleset: 'PvE', name: 'Test Guild' },
        players: [player], parameters: { lastUpdate: 100 } };
    const saved = { equipment: [], statistics: {}, fetchedAt: Date.now() };
    const data = await collectForever({ client: mockClient({}), configuration, policy, previous,
        profiles: { 'PvE/First Last': saved } });
    assert.deepEqual(data.players, [player]);
    assert.deepEqual(data.profiles['PvE/First Last'], saved);
    assert.equal(data.sources.blizzard.roster, 'cached');
    assert.equal(data.parameters.lastUpdate, 100);
    const changedGuild = await collectForever({ client: mockClient({}), configuration: { ...configuration, guildId: 43 }, policy, previous });
    assert.deepEqual(changedGuild.players, []);
});

test('rechecking a first unavailable snapshot does not invent a cached roster', async () => {
    const previous = { mode: 'live', guild: { id: 42, region: 'eu', ruleset: 'PvE', name: 'Test Guild' },
        players: [], parameters: {} };
    const data = await collectForever({ client: mockClient({}), configuration, policy, previous });
    assert.equal(data.sources.blizzard.roster, 'unavailable');
    assert.equal(data.parameters.lastUpdate, undefined);
});

test('an actually empty roster clears old membership; a mismatched guild or transient failure is fatal', async () => {
    const data = await collectForever({ client: mockClient({ '/data/wow/guild/test-guild/roster': { guild: { id: 42 }, members: [] } }), configuration, policy });
    assert.equal(data.sources.blizzard.roster, 'available');
    assert.deepEqual(data.players, []);
    await assert.rejects(collectForever({ client: mockClient({ '/data/wow/guild/test-guild': { id: 99 } }), configuration, policy }), /does not match/);
    await assert.rejects(collectForever({ client: mockClient({ '/data/wow/guild/test-guild': new BlizzardError(503) }), configuration, policy }), /503/);
});

test('only level-60 overdue profiles are requested, while unavailable details do not break the roster', async () => {
    const client = mockClient({ '/data/wow/guild/test-guild/roster': { guild: { id: 42 }, members: [
        { character: { ...summary, level: 10 }, rank: 3 },
        { character: { ...summary, id: 12, name: 'Other' }, rank: 4 },
    ] } });
    const data = await collectForever({ client, configuration, policy });
    assert.equal(data.players.length, 2);
    assert.equal(data.sources.blizzard.roster, 'available');
    assert.ok(!client.calls.some(path => path.includes('first-last')));
    assert.ok(client.calls.some(path => path.endsWith('other-last')));
    assert.equal(data.players[1].equipmentAvailable, false);
});

test('fresh cached details are reused within policy limits', async () => {
    const player = { ...mapPlayer(summary), equipmentAvailable: true };
    const previous = { mode: 'live', guild: { ...configuration, id: 42, name: 'Test Guild' }, players: [player], parameters: { lastUpdate: 100 } };
    const client = mockClient({ '/data/wow/guild/test-guild/roster': roster });
    const data = await collectForever({ client, configuration, policy, previous,
        profiles: { 'PvE/First Last': { equipment: [], statistics: {}, fetchedAt: Date.now() } } });
    assert.equal(data.players[0].equipmentAvailable, true);
    assert.ok(!client.calls.some(path => path.startsWith('/profile/')));
});

test('Forever equipment and statistics normalize nested values without inventing a model or talent build', () => {
    const item = mapEquipment(equipment)[0];
    assert.equal(item.itemLevel, 9);
    assert.deepEqual(item.stats, ['10 - 16 Damage']);
    assert.equal(item.appearance, undefined);
    assert.equal(mapStatistics(statistics).meleeCrit, 4.616);
    assert.equal(mapStatistics(statistics).powerType, 'Mana');
});

test('canonical character URLs and legacy equipment tooltip details survive normalization', () => {
    const player = mapPlayer({ ...summary, key: { href: 'https://eu.api.blizzard.com/profile/wow/character/canonical-name?namespace=profile-forever-eu' } });
    assert.equal(player.slug, 'canonical-name');
    const item = mapEquipment({ equipped_items: [{ ...equipment.equipped_items[0],
        transmog: { display_string: 'Transmogrified to Test sword' }, enchantments: [
            { display_string: 'Enchanted: +5 Strength', enchantment_slot: { id: 0 } },
            { display_string: 'Socket Bonus: +2 Stamina', enchantment_slot: { id: 5 } },
            { display_string: '+3 Strength', source_item: { id: 8 }, enchantment_slot: { id: 2 } },
        ] }] }, new Map([[8, 'icons/test.webp']]))[0];
    assert.equal(item.enchant, '+5 Strength');
    assert.equal(item.socketBonus, '+2 Stamina');
    assert.equal(item.transmog, 'Transmogrified to Test sword');
    assert.deepEqual(item.sockets, [{ id: 8, display: '+3 Strength', media: 'icons/test.webp' }]);
});

test('transport never forwards authentication to an untrusted URL, redirect or wrong namespace', async () => {
    const calls = [];
    const client = createBlizzardClient({ clientId: 'fixture-id', clientSecret: 'fixture-secret', region: 'eu', sleep: async () => {},
        fetchImpl: async (url, options) => {
            calls.push({ url: String(url), options });
            if (String(url).includes('/token')) return Response.json({ access_token: 'fixture-token' });
            return Response.json({ id: 42 });
        } });
    for (const path of ['https://example.com/data/wow/guild/test',
        'https://us.api.blizzard.com/data/wow/guild/test', '/data/wow/guild/test?access_token=anything',
        '/data/wow/guild/test?namespace=profile-eu']) await assert.rejects(client.get(path));
    assert.equal(calls.length, 0);
    await client.get('/data/wow/guild/test');
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.options.redirect === 'error'));
    assert.ok(calls.every(call => !call.url.includes('fixture-secret') && !call.url.includes('fixture-token')));
    assert.ok(calls[1].url.includes('namespace=profile-forever-eu'));
    assert.ok(calls[1].options.headers.Authorization === 'Bearer fixture-token');
});

test('authentication, remote and network errors cannot echo fixture secrets or tokens', async () => {
    for (const scenario of ['auth', 'remote', 'network']) {
        const client = createBlizzardClient({ clientId: 'fixture-id', clientSecret: 'fixture-secret', region: 'eu', sleep: async () => {},
            fetchImpl: async url => {
                if (scenario === 'network') throw new Error('fixture-secret fixture-token');
                if (String(url).includes('/token')) return scenario === 'auth'
                    ? Response.json({ error: 'fixture-secret fixture-token' }, { status: 400 })
                    : Response.json({ access_token: 'fixture-token' });
                return Response.json({ error: 'fixture-secret fixture-token' }, { status: 404 });
            } });
        await assert.rejects(client.get('/data/wow/guild/test'), error =>
            !String(error).includes('fixture-secret') && !String(error).includes('fixture-token'));
    }
});

test('rate limiting retries are bounded', async () => {
    let count = 0;
    const delays = [];
    const client = createBlizzardClient({ clientId: 'fixture-id', clientSecret: 'fixture-secret', region: 'eu', maxRetries: 1,
        sleep: async ms => delays.push(ms), fetchImpl: async url => {
            if (String(url).includes('/token')) return Response.json({ access_token: 'fixture-token' });
            count++;
            return Response.json({}, { status: 429, headers: { 'retry-after': '1000' } });
        } });
    await assert.rejects(client.get('/data/wow/guild/test'), /429/);
    assert.equal(count, 2);
    assert.ok(delays.every(ms => ms <= 30_000));
});

test('offline preparation preserves live data and a credential-free invocation requires consent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'forever-prepare-'));
    try {
        const { mkdir } = await import('node:fs/promises');
        await mkdir(join(directory, 'site/public/data'), { recursive: true });
        const contents = JSON.stringify({ schemaVersion: 2, mode: 'live', players: [] });
        await writeFile(join(directory, 'site/public/data/snapshot.json'), contents);
        const prepared = spawnSync(process.execPath, [resolve('scripts/prepare-data.mjs')], { cwd: directory, encoding: 'utf8' });
        assert.equal(prepared.status, 0);
        assert.equal(await readFile(join(directory, 'site/public/data/snapshot.json'), 'utf8'), contents);
        const guarded = spawnSync(process.execPath, [resolve('scripts/refresh-forever.mjs')], { cwd: directory, encoding: 'utf8' });
        assert.equal(guarded.status, 1);
        assert.ok(!guarded.stderr.includes('ENOENT'));
    } finally { await rm(directory, { recursive: true, force: true }); }
});
