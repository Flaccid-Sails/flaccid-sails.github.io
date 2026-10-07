import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCatalog, normalizeTalents, CLASS_NAMES } from './talent-source.mjs';
import { refreshTalents } from './refresh-talents.mjs';

const saved = JSON.parse(await readFile(new URL('../data/talents.json', import.meta.url), 'utf8'));
function source() {
    return {
        license: 'CC-BY-4.0', generated: '2026-10-06', talents: Object.fromEntries(Object.entries(saved.classes).map(([name, c]) => [name, {
            ...c, trees: c.trees.map(t => ({ ...t, talents: t.talents.map(n => ({ ...n, desc: n.descriptions, req: n.prerequisite, classic: { status: n.status } })) })),
        }]))
    };
}

test('bundled talent source contains all classes, three trees and complete ranks', () => {
    assert.equal('source' in saved, false);
    const data = normalizeTalents(source());
    assert.deepEqual(Object.keys(data.classes), CLASS_NAMES);
    assert.ok(Object.values(data.classes).flatMap(c => c.trees).flatMap(t => t.talents).length > 450);
});

test('missing classes, changed licenses and broken prerequisites are rejected', () => {
    const missing = source(); delete missing.talents.Mage;
    assert.throws(() => normalizeTalents(missing), /Mage/);
    const license = source(); license.license = 'All rights reserved';
    assert.throws(() => normalizeTalents(license), /license/);
    const broken = source(); broken.talents.Warrior.trees[0].talents[0].req = 'Missing talent';
    assert.throws(() => normalizeTalents(broken), /prerequisite/);
});

test('tuning changes update the hash and changed date, unchanged checks retain the change date', () => {
    const first = createCatalog(source(), undefined, '2026-10-07T00:00:00Z');
    const same = createCatalog(source(), first, '2026-10-07T02:00:00Z');
    assert.equal(same.changedAt, first.changedAt);
    assert.notEqual(same.checkedAt, first.checkedAt);
    const changed = source(); changed.talents.Warrior.trees[0].talents[0].desc[0] = 'Updated beta effect.';
    const next = createCatalog(changed, same, '2026-10-07T04:00:00Z');
    assert.notEqual(next.contentHash, same.contentHash);
    assert.equal(next.changedAt, next.checkedAt);
});

test('failed refresh preserves the complete previous file, and HTTP 304 advances only the check date', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'flaccid-talents-'));
    const destination = join(dir, 'talents.json');
    try {
        const previous = { ...saved, etag: '"previous"' };
        const bytes = JSON.stringify(previous);
        await writeFile(destination, bytes);
        await assert.rejects(refreshTalents({ destination, fetchImpl: async () => new Response('{"talents":{}}', { status: 200 }) }));
        assert.equal(await readFile(destination, 'utf8'), bytes);
        await assert.rejects(refreshTalents({ destination, fetchImpl: async () => new Response('Denied', { status: 403 }) }), /403/);
        assert.equal(await readFile(destination, 'utf8'), bytes);
        const result = await refreshTalents({
            destination, now: '2026-10-07T08:00:00Z', fetchImpl: async (_url, options) => {
                assert.equal(options.headers['If-None-Match'], '"previous"');
                return new Response(null, { status: 304 });
            }
        });
        assert.equal(result.checkedAt, '2026-10-07T08:00:00Z');
        assert.equal(result.changedAt, saved.changedAt);
        assert.deepEqual(result.classes, saved.classes);
    } finally { await rm(dir, { recursive: true, force: true }); }
});
