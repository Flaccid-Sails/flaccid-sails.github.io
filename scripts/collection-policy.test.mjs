import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planCharacterRefresh, planReportRefresh } from './collection-policy.mjs';
const policy = JSON.parse(await readFile(new URL('../config/collection-policy.json', import.meta.url), 'utf8'));
const now = Date.parse('2026-10-07T12:00:00Z');
const hour = 3_600_000;
const player = (name, level = 60) => ({ name, realm: 'Preview', level });

test('only level 60 players get detailed requests', () => {
    assert.deepEqual(planCharacterRefresh([player('Low', 59), player('Ready'), player('High', 61)], {}, policy, now), [player('Ready')]);
});

test('fresh and inactive profiles are deferred while overdue profiles are queued', () => {
    const roster = ['Fresh', 'Active', 'Inactive', 'Stale'].map(n => player(n));
    const cache = {
        'Preview/Fresh': { fetchedAt: now - hour, lastLogin: now },
        'Preview/Active': { fetchedAt: now - 6 * hour, lastLogin: now },
        'Preview/Inactive': { fetchedAt: now - 48 * hour, lastLogin: now - 30 * 24 * hour },
        'Preview/Stale': { fetchedAt: now - 168 * hour, lastLogin: now - 30 * 24 * hour },
    };
    assert.deepEqual(planCharacterRefresh(roster, cache, policy, now).map(p => p.name), ['Stale', 'Active']);
    assert.equal(planCharacterRefresh(roster, cache, { ...policy, maxCharactersPerRun: 1 }, now).length, 1);
});

test('only new or updated reports are requested, with a per-run cap', () => {
    const reports = [{ code: 'unchanged', endTime: 10 }, { code: 'updated', endTime: 20 }, { code: 'new', endTime: 30 }];
    assert.deepEqual(planReportRefresh(reports, { unchanged: { endTime: 10 }, updated: { endTime: 15 } }, policy).map(r => r.code), ['new', 'updated']);
    assert.equal(planReportRefresh(reports, {}, { ...policy, maxReportsPerRun: 1 }).length, 1);
});
