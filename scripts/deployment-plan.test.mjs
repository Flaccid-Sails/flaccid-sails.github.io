import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { guildContentHash, planDeployment } from './deployment-plan.mjs';
import { publishForever } from './refresh-forever.mjs';

function content() {
    return {
        guild: { id: 42, name: 'Test Guild', region: 'eu', ruleset: 'PvE' },
        players: [{ id: 11, name: 'Sailor', level: 60, rank: 3, lastLogin: 100 }],
        profiles: { 'PvE/Sailor': { equipment: [{ id: 5, name: 'Sword' }], statistics: { health: 200 }, fetchedAt: 100 } },
        parameters: { maxLevel: 60, minimumRaidItemLevel: 60, lastUpdate: 100 },
        sources: { blizzard: { roster: 'available', checkedAt: '2026-11-06T00:00:00Z' }, warcraftLogs: { status: 'unavailable' } },
    };
}
function talents() {
    return { schemaVersion: 1, checkedAt: '2026-11-06T00:00:00Z', changedAt: '2026-11-05T00:00:00Z',
        sourceGeneratedAt: '2026-11-05', contentHash: 'old-source-hash', etag: 'old-etag', lastModified: 'yesterday',
        classes: { Warrior: { trees: [{ name: 'Arms', talents: [{ name: 'Test talent', descriptions: ['Old effect'] }] }] } } };
}
async function write(directory, file, contents) {
    const path = join(directory, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
}
async function fixture(t) {
    const directory = await mkdtemp(join(tmpdir(), 'flaccid-deployment-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    for (const file of ['package.json', 'package-lock.json', 'site/index.html', 'site/package.json',
        'site/tsconfig.json', 'site/vite.config.ts', 'scripts/prepare-data.mjs', 'scripts/build-image-sw.mjs',
        'scripts/refresh-forever.mjs', 'scripts/deployment-plan.mjs', 'site/src/App.tsx', 'site/public/icons/test.webp']) {
        await write(directory, file, `Fixture: ${file}`);
    }
    await publishForever(content(), talents(), join(directory, 'site/public/data'));
    return directory;
}
async function markDeployed(directory, fingerprint) {
    await write(directory, '.cache/site-deployment/fingerprint', `${fingerprint}\n`);
}

test('unchanged checks skip publishing despite new snapshot, profile, and talent filenames', async t => {
    const directory = await fixture(t);
    const first = await planDeployment({ directory });
    assert.equal(first.deploy, true);
    await markDeployed(directory, first.fingerprint);
    const before = JSON.parse(await readFile(join(directory, 'site/public/data/snapshot.json'), 'utf8'));
    const data = content();
    data.parameters.lastUpdate = 200;
    data.sources.blizzard.checkedAt = '2026-11-06T01:00:00Z';
    data.profiles['PvE/Sailor'].fetchedAt = 200;
    const catalog = talents();
    for (const field of ['checkedAt', 'changedAt', 'sourceGeneratedAt', 'contentHash', 'etag', 'lastModified']) catalog[field] = 'new';
    const after = await publishForever(data, catalog, join(directory, 'site/public/data'));
    assert.notEqual(after.characterIndexFile, before.characterIndexFile);
    assert.notEqual(after.talentCatalogFile, before.talentCatalogFile);
    assert.equal(after.parameters.lastUpdate, 200);
    assert.equal(after.contentHash, before.contentHash);
    const next = await planDeployment({ directory });
    assert.equal(next.fingerprint, first.fingerprint);
    assert.equal(next.deploy, false);
});

test('real guild, profile, availability, and talent changes require publishing', async t => {
    const cases = {
        level: data => data.players[0].level++,
        membership: data => data.players.push({ id: 12, name: 'New Sailor', level: 1 }),
        departure: data => { data.players = []; data.profiles = {}; },
        rank: data => data.players[0].rank++,
        login: data => data.players[0].lastLogin++,
        equipment: data => data.profiles['PvE/Sailor'].equipment[0].id++,
        statistics: data => data.profiles['PvE/Sailor'].statistics.health++,
        availability: data => { data.sources.blizzard.roster = 'cached'; },
        firstLoad: data => { delete data.parameters.lastUpdate; },
        guild: data => { data.guild.name = 'Renamed Guild'; },
        talent: (_data, catalog) => { catalog.classes.Warrior.trees[0].talents[0].descriptions = ['New effect']; },
    };
    for (const [name, change] of Object.entries(cases)) await t.test(name, async t => {
        const directory = await fixture(t);
        const baseline = await planDeployment({ directory });
        await markDeployed(directory, baseline.fingerprint);
        const data = content();
        const catalog = talents();
        change(data, catalog);
        await publishForever(data, catalog, join(directory, 'site/public/data'));
        const next = await planDeployment({ directory });
        assert.equal(next.deploy, true);
        assert.notEqual(next.fingerprint, baseline.fingerprint);
    });
});

test('JSON object ordering does not create false changes', () => {
    const data = content();
    const reordered = { ...data, guild: Object.fromEntries(Object.entries(data.guild).reverse()) };
    assert.equal(guildContentHash(data, talents()), guildContentHash(reordered, talents()));
});

test('source, styles, icons, dependencies, build scripts, and build URLs trigger publishing', async t => {
    for (const file of ['site/src/App.tsx', 'site/src/style.scss', 'site/public/icons/test.webp',
        'package-lock.json', 'site/vite.config.ts', 'scripts/build-image-sw.mjs', 'scripts/refresh-forever.mjs']) await t.test(file, async t => {
        const directory = await fixture(t);
        const first = await planDeployment({ directory });
        await markDeployed(directory, first.fingerprint);
        await write(directory, file, 'Updated build input');
        assert.equal((await planDeployment({ directory })).deploy, true);
    });
    const directory = await fixture(t);
    const first = await planDeployment({ directory });
    await markDeployed(directory, first.fingerprint);
    assert.equal((await planDeployment({ directory, basePath: '/guild/' })).deploy, true);
    assert.equal((await planDeployment({ directory, artworkBaseUrl: 'https://example.test/assets/' })).deploy, true);
    await rm(join(directory, 'site/public/icons/test.webp'));
    assert.equal((await planDeployment({ directory })).deploy, true);
});

test('stale data, build output, docs, and synthetic env files do not affect publishing', async t => {
    const directory = await fixture(t);
    const first = await planDeployment({ directory });
    await markDeployed(directory, first.fingerprint);
    for (const file of ['site/public/data/catalog/unused.json', 'site/dist/index.html',
        'README.md', '.env.local', 'site/.env.local', 'site/src/.env.local']) {
        await write(directory, file, 'Unrelated synthetic fixture');
    }
    assert.equal((await planDeployment({ directory })).deploy, false);
});

test('failed deployment retries, content reversions, missing state, and manual force are safe', async t => {
    const directory = await fixture(t);
    const first = await planDeployment({ directory });
    await markDeployed(directory, first.fingerprint);
    const data = content();
    data.players[0].level++;
    await publishForever(data, talents(), join(directory, 'site/public/data'));
    const attempted = await planDeployment({ directory });
    assert.equal(attempted.deploy, true);
    // A failed deployment never updates the baseline, even if collection was cached.
    assert.equal((await planDeployment({ directory })).deploy, true);
    assert.equal((await readFile(join(directory, '.cache/site-deployment/fingerprint'), 'utf8')).trim(), first.fingerprint);
    await markDeployed(directory, attempted.fingerprint);
    assert.equal((await planDeployment({ directory })).deploy, false);
    assert.equal((await planDeployment({ directory, force: true })).deploy, true);
    // Compare against the latest published content, not every hash ever published.
    await publishForever(content(), talents(), join(directory, 'site/public/data'));
    assert.equal((await planDeployment({ directory })).deploy, true);
    await rm(join(directory, '.cache/site-deployment/fingerprint'));
    assert.equal((await planDeployment({ directory })).deploy, true);
});

test('a missing or old snapshot fails rather than incorrectly skipping publishing', async t => {
    const directory = await fixture(t);
    await write(directory, 'site/public/data/snapshot.json', JSON.stringify({ schemaVersion: 2, mode: 'live' }));
    await assert.rejects(planDeployment({ directory }), /freshly collected/);
    await rm(join(directory, 'site/public/data/snapshot.json'));
    await assert.rejects(planDeployment({ directory }), { code: 'ENOENT' });
});

test('the CLI emits the deployment decision and summary without changing the deployment baseline', async t => {
    const directory = await fixture(t);
    const first = await planDeployment({ directory });
    await markDeployed(directory, first.fingerprint);
    const output = join(directory, 'output');
    const summary = join(directory, 'summary');
    const script = fileURLToPath(new URL('./deployment-plan.mjs', import.meta.url));
    execFileSync(process.execPath, [script], { cwd: directory,
        env: { GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary }, stdio: 'pipe' });
    assert.equal(await readFile(output, 'utf8'), `fingerprint=${first.fingerprint}\ndeploy=false\n`);
    assert.match(await readFile(summary, 'utf8'), /skipping build, upload, and deployment/);
    assert.equal((await readFile(join(directory, '.cache/site-deployment/fingerprint'), 'utf8')).trim(), first.fingerprint);
});
