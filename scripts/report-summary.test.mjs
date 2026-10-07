import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReports } from './report-summary.mjs';

test('dashboard summary keeps only the highest difficulty and best character logs', () => {
    const log = (name, value) => ({ name, realm: 'Preview', log: value, dps: value * 10, hps: value * 5 });
    const reports = [
        { bosses: [{ id: 1, difficulty: 3, dps: [log('Sailor', 90)], tanks: [], healers: [] }] },
        { bosses: [{ id: 1, difficulty: 4, dps: [log('Sailor', 65)], tanks: [], healers: [log('Healer', 70)] }] },
        { bosses: [{ id: 1, difficulty: 4, dps: [log('Sailor', 80)], tanks: [], healers: [log('Healer', 75)] }] },
    ];
    const [boss] = summarizeReports(reports, [{ bosses: [{ id: 1, name: 'Reef Guardian' }] }]);
    assert.equal(boss.name, 'Reef Guardian');
    assert.equal(boss.difficulty, 4);
    assert.deepEqual(boss.dps, [log('Sailor', 80)]);
    assert.deepEqual(boss.healers, [log('Healer', 75)]);
    assert.equal(boss.maxDps, 800);
    assert.equal(boss.maxHps, 375);
});
