import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReports } from './report-summary.mjs';

test('dashboard summary keeps only the highest difficulty and best character logs', () => {
    const log = (name, value) => ({ name, realm: 'Preview', log: value });
    const sourceLog = (name, value) => ({ ...log(name, value), dps: value * 10, hps: value * 5 });
    const reports = [
        { bosses: [{ id: 1, difficulty: 3, dps: [sourceLog('Sailor', 90)], tanks: [], healers: [] }] },
        { bosses: [{ id: 1, difficulty: 4, dps: [sourceLog('Sailor', 65)], tanks: [], healers: [sourceLog('Healer', 70)] }] },
        { bosses: [{ id: 1, difficulty: 4, dps: [sourceLog('Sailor', 80)], tanks: [], healers: [sourceLog('Healer', 75)] }] },
    ];
    const [boss] = summarizeReports(reports, [{ bosses: [{ id: 1, name: 'Reef Guardian' }] }]);
    assert.equal(boss.name, 'Reef Guardian');
    assert.equal(boss.difficulty, 4);
    assert.deepEqual(boss.dps, [log('Sailor', 80)]);
    assert.deepEqual(boss.healers, [log('Healer', 75)]);
});
