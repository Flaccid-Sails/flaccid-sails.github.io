import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createBlizzardClient, BlizzardError } from './blizzard-client.mjs';
import { characterRender, characterTalents, collectForever, mapPlayer, mapEquipment, mapStatistics } from './forever-data.mjs';
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
        profiles: { 'PvE/First Last': { equipment: [], statistics: {}, fetchedAt: Date.now(), detailsVersion: 3 } } });
    assert.equal(data.players[0].equipmentAvailable, true);
    assert.ok(!client.calls.some(path => path.startsWith('/profile/')));
});

test('an exhausted character request preserves its last complete details and the next run retries it', async () => {
    const path = '/profile/wow/character/first-last';
    const key = 'PvE/First Last';
    const second = { ...summary, name: 'Second', id: 12 };
    const routes = {
        '/data/wow/guild/test-guild/roster': { ...roster, members: [
            { character: summary, rank: 1 }, { character: second, rank: 2 },
        ] },
        [path]: { ...summary, average_item_level: 60 },
        [path + '/equipment']: { equipped_items: [{ ...equipment.equipped_items[0],
            media: { key: { href: '/data/wow/media/item/5' } } }] },
        [path + '/statistics']: statistics,
        '/data/wow/media/item/5': new BlizzardError(503),
        '/profile/wow/character/second-last': { ...second, average_item_level: 55 },
    };
    const player = { ...mapPlayer(summary), itemLevel: 50, characterPortrait: 'https://render.worldofwarcraft.com/old.jpg' };
    const previous = { mode: 'live', guild: { id: 42, region: 'eu', ruleset: 'PvE' },
        players: [player], parameters: { lastUpdate: 1 } };
    const saved = { equipment: [{ id: 9 }], statistics: { health: 100 }, talentBuilds: [{ name: 'Active' }],
        detailsVersion: 3, fetchedAt: 0 };
    const failed = mockClient(routes);
    const data = await collectForever({ client: failed, configuration, policy, previous, profiles: { [key]: saved } });
    assert.ok(failed.calls.indexOf('/data/wow/media/item/5') < failed.calls.indexOf('/profile/wow/character/second-last'));
    assert.equal(data.sources.blizzard.roster, 'available');
    assert.deepEqual(data.profiles[key], saved);
    assert.deepEqual(data.players[0], { ...player, rank: 1, equipmentAvailable: true, talentsAvailable: true });
    assert.equal(data.players[1].itemLevel, 55);

    const client = mockClient({ ...routes, '/data/wow/media/item/5': { assets: [] } });
    const recovered = await collectForever({ client, configuration, policy, previous: { ...data, mode: 'live' }, profiles: data.profiles });
    assert.equal(recovered.players[0].itemLevel, 60);
    assert.equal(recovered.profiles[key].equipment[0].id, 5);
    assert.ok(recovered.profiles[key].fetchedAt > saved.fetchedAt);
    assert.ok(!client.calls.includes('/profile/wow/character/second-last'));
});

test('a new character with a timed-out profile remains on the roster and eligible for details', async () => {
    const path = '/profile/wow/character/first-last';
    const routes = { '/data/wow/guild/test-guild/roster': roster, [path]: new BlizzardError(408) };
    const partial = await collectForever({ client: mockClient(routes), configuration, policy });
    assert.deepEqual(partial.profiles, {});
    assert.equal(partial.players[0].itemLevel, -1);
    assert.equal(partial.players[0].equipmentAvailable, false);
    const recovered = await collectForever({ client: mockClient({ ...routes, [path]: { ...summary, average_item_level: 52 } }),
        configuration, policy, previous: { ...partial, mode: 'live' }, profiles: partial.profiles });
    assert.equal(recovered.players[0].itemLevel, 52);
});

test('a level-60 profile backfills Blizzard media and talents, then serves both from cache', async () => {
    const path = '/profile/wow/character/first-last';
    const key = 'PvE/First Last';
    const group = { is_active: true, specializations: [{ specialization: { name: 'Holy' }, spent_points: 2,
        talents: [{ talent: { name: 'Divine Strength' }, talent_rank: 2 }] }] };
    const specs = { character: { id: 11 }, specialization_groups: [group] };
    const render = 'https://render.worldofwarcraft.com/forever-eu/character/1/11-main-raw.png';
    const portrait = 'https://render.worldofwarcraft.com/forever-eu/character/1/11-avatar.jpg';
    const media = { character: { id: 11 }, assets: [
        { key: 'avatar-sd', value: portrait.replace('avatar.jpg', 'avatar-sd.jpg') },
        { key: 'main-raw', value: render }, { key: 'avatar', value: portrait },
    ] };
    const previous = { mode: 'live', guild: { id: 42, region: 'eu', ruleset: 'PvE' },
        players: [mapPlayer(summary)], parameters: { lastUpdate: 1 } };
    const routes = { '/data/wow/guild/test-guild/roster': roster, [path]: summary,
        [path + '/specializations']: specs, [path + '/character-media']: media,
        [path + '/statistics']: statistics, [path + '/equipment']: equipment };
    const collected = await collectForever({ client: mockClient(routes), configuration, policy, previous,
        profiles: { [key]: { fetchedAt: Date.now(), detailsVersion: 2, equipment: [], statistics: {} } } });
    assert.equal(collected.players[0].characterRender, render);
    assert.equal(collected.players[0].characterPortrait, portrait);
    assert.equal(collected.players[0].talentsAvailable, true);
    assert.deepEqual(collected.profiles[key].talentBuilds, [{ name: 'Active', ranks: { 'Holy/Divine Strength': 2 } }]);
    const cachedClient = mockClient(routes);
    const cached = await collectForever({ client: cachedClient, configuration, policy,
        previous: { ...collected, mode: 'live' }, profiles: collected.profiles });
    assert.equal(cached.players[0].talentsAvailable, true);
    assert.equal(cached.players[0].characterRender, render);
    assert.equal(cached.players[0].characterPortrait, portrait);
    assert.ok(cachedClient.calls.every(call => !call.startsWith('/profile/')));
    const partial = await collectForever({ client: mockClient({ ...routes, [path + '/equipment']: new BlizzardError(404) }),
        configuration, policy });
    assert.equal(partial.players[0].equipmentAvailable, false);
    assert.equal(partial.players[0].talentsAvailable, true);
    assert.equal(characterRender(media, 12), undefined);
    assert.equal(characterRender({ ...media, assets: [{ key: 'main-raw', value: render + '?token=fixture' }] }, 11), undefined);
    assert.equal(characterTalents(specs, 12), undefined);
    group.specializations[0].spent_points = 5;
    assert.equal(characterTalents(specs, 11), undefined);
});

test('a refreshed portrait uses the SD avatar if needed and drops unavailable or mismatched avatars', async () => {
    const path = '/profile/wow/character/first-last';
    const base = 'https://render.worldofwarcraft.com/forever-eu/character/1/11';
    const sd = { key: 'avatar-sd', value: base + '-avatar-sd.jpg' };
    const previous = { mode: 'live', guild: { id: 42, region: 'eu', ruleset: 'PvE' }, parameters: { lastUpdate: 1 },
        players: [{ ...mapPlayer(summary), characterPortrait: base + '-avatar.jpg' }] };
    for (const [media, expected] of [
        [{ character: { id: 11 }, assets: [sd] }, sd.value],
        [{ character: { id: 12 }, assets: [sd] }, undefined],
        [{ character: { id: 11 }, assets: [{ key: 'avatar', value: base + '-avatar.jpg?token=fixture' }] }, undefined],
        [{ character: { id: 11 }, assets: [{ key: 'main-raw', value: base + '-main-raw.png' }] }, undefined],
    ]) {
        const client = mockClient({ '/data/wow/guild/test-guild/roster': roster, [path]: summary, [path + '/character-media']: media });
        const { players } = await collectForever({ client, configuration, policy, previous });
        assert.equal(players[0].characterPortrait, expected);
        assert.equal(players[0].image, 'icons/class_paladin.webp');
        assert.equal(client.calls.filter(url => url.endsWith('/character-media')).length, 1);
    }
});

test('both published image URLs follow gear changes even when Blizzard reuses its URLs and item level', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'forever-gear-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const path = '/profile/wow/character/first-last';
    const base = 'https://render.worldofwarcraft.com/forever-eu/character/1/11';
    const originals = [base + '-main-raw.png', base + '-avatar.jpg'];
    const media = { character: { id: 11 }, assets: [
        { key: 'main-raw', value: originals[0] }, { key: 'avatar', value: originals[1] },
    ] };
    const sword = equipment.equipped_items[0];
    const helm = { ...sword, slot: { type: 'HEAD' }, item: { id: 6 } };
    const otherHelm = { ...helm, item: { id: 7 } };
    let now = Date.now(), previous, profiles;
    async function refresh(items, stats = statistics) {
        now += 7 * 3_600_000;
        const client = mockClient({ '/data/wow/guild/test-guild/roster': roster, [path]: summary,
            [path + '/character-media']: media, [path + '/statistics']: stats,
            [path + '/equipment']: items ? { equipped_items: items } : new BlizzardError(404) });
        const data = await collectForever({ client, configuration, policy, now, previous, profiles });
        profiles = data.profiles;
        previous = await publishForever(data, {}, directory);
        return [previous.players[0].characterRender, previous.players[0].characterPortrait];
    }
    const initial = await refresh([sword, helm]);
    assert.deepEqual(initial, originals.map(url => url + '?gear=' + now));
    assert.deepEqual(await refresh([helm, sword]), initial);
    assert.deepEqual(await refresh(undefined), initial);
    const swapped = await refresh([sword, otherHelm], new BlizzardError(404));
    assert.deepEqual(swapped, originals.map(url => url + '?gear=' + now));
    assert.deepEqual(await refresh([sword, otherHelm]), swapped);
    assert.deepEqual(await refresh([sword, { ...otherHelm, transmog: { item: { id: 8 } } }]),
        originals.map(url => url + '?gear=' + now));
    assert.deepEqual(await refresh([sword, helm]), originals.map(url => url + '?gear=' + now));
    assert.deepEqual(await refresh([]), originals.map(url => url + '?gear=' + now));
});

test('Forever equipment and statistics normalize nested values without inventing a model or talent build', () => {
    const item = mapEquipment(equipment)[0];
    assert.equal(item.itemLevel, 9);
    assert.deepEqual(item.stats, ['10 - 16 Damage']);
    assert.equal(item.appearance, undefined);
    assert.equal(mapStatistics(statistics).meleeCrit, 4.616);
    assert.equal(mapStatistics(statistics).powerType, 'Mana');
});

test('Undead characters use the standard model when Blizzard provides both renders', () => {
    const base = 'https://render.worldofwarcraft.com/forever-eu/character/1/11';
    const hd = { key: 'main-raw', value: base + '-main-raw.png' };
    const sd = { key: 'main-sd-raw', value: base + '-main-sd-raw.png' };
    const media = { character: { id: 11 }, assets: [hd, sd] };
    assert.equal(characterRender(media, 11, 5), sd.value);
    assert.equal(characterRender(media, 11, 1), hd.value);
    assert.equal(characterRender({ ...media, assets: [hd] }, 11, 5), hd.value);
});

test('specializations keep alternate builds, unspent points, and the active group first', () => {
    const group = (is_active, spent_points) => ({ is_active, specializations: [{ specialization_name: 'Holy',
        spent_points, talents: spent_points ? [{ talent: { name: 'Divine Strength' }, talent_rank: spent_points }] : [] }] });
    assert.deepEqual(characterTalents({ character: { id: 11 },
        specialization_groups: [group(false, 0), group(true, 3)] }, 11), [
        { name: 'Active', ranks: { 'Holy/Divine Strength': 3 } }, { name: 'Alternate', ranks: {} },
    ]);
});

test('additional Forever modifiers preserve zero and distinguish melee, ranged and spell hit', () => {
    const stats = mapStatistics({ movement_speed: 100, melee_hit: { value: 4 }, ranged_hit: { value: 3 },
        spell_hit: { value: 5 }, expertise: 0 });
    assert.deepEqual([stats.movementSpeed, stats.meleeHit, stats.rangedHit, stats.spellHit, stats.expertise],
        [100, 4, 3, 5, 0]);
    assert.equal(stats.rangedAttackPower, undefined);
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

test('the client recovers from a temporary token failure, a timeout and an interrupted API response', async () => {
    const replies = [
        Response.json({}, { status: 503 }), Response.json({ access_token: 'fixture-token' }),
        new Error('fixture network failure'), new Response('{"members":'), Response.json(roster),
    ];
    const calls = [];
    const client = createBlizzardClient({ clientId: 'fixture-id', clientSecret: 'fixture-secret', region: 'eu',
        sleep: async () => {}, maxRetries: 2, fetchImpl: async url => {
            calls.push(new URL(url).pathname);
            const reply = replies.shift();
            if (reply instanceof Error) throw reply;
            return reply;
        } });
    const path = '/data/wow/guild/test-guild/roster';
    assert.deepEqual(await client.get(path), roster);
    assert.deepEqual(calls, ['/token', '/token', path, path, path]);
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
