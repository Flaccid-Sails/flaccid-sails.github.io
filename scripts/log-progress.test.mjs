import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPlayerLogHistory, searchLogHistory, selectLogSeries, summarizeLogSeries } from '../site/src/utils/log-progress.ts';

const parse = (log, name = 'Sailor', realm = 'Preview') => ({ name, realm, log });
const boss = (id = 1, difficulty = 3, roles = {}) => ({ id, difficulty, dps: [], tanks: [], healers: [], ...roles });
const report = (code, endTime, bosses, zoneId = 1) => ({ code, endTime, bosses, zoneId, title: code });
const selection = { zoneId: 1, bossId: 1, difficulty: 3, role: 'dps' };

test('search finds bosses and raid nights while retaining encounter identity and the full comparison history', () => {
    const history = collectPlayerLogHistory([
        report('First voyage', 1000, [boss(1, 3, { dps: [parse(42)] }), boss(2, 3, { dps: [parse(60)] })]),
        report('Rough waters', 2000, [boss(1, 3, { dps: [parse(55)] }), boss(2, 3, { dps: [parse(65)] })]),
        report('Other voyage', 3000, [boss(1, 3, { dps: [parse(70)] })], 2),
    ]).get('Preview/Sailor');
    const zones = [
        { id: 1, name: 'Demo raid', bosses: [{ id: 1, name: 'Reef Guardian' }, { id: 2, name: 'Admiral Blackwake' }] },
        { id: 2, name: 'Other raid', bosses: [{ id: 1, name: 'Drowned King' }] },
    ];
    assert.deepEqual(searchLogHistory(history, zones, '  REEF  ').map(entry => entry.reportCode), ['First voyage', 'Rough waters']);
    assert.deepEqual(searchLogHistory(history, zones, 'rough').map(entry => entry.bossId), [1, 2]);
    assert.deepEqual(searchLogHistory(history, zones, 'drowned').map(entry => entry.zoneId), [2]);
    assert.equal(searchLogHistory(history, zones, 'other raid').length, 1);
    assert.deepEqual(searchLogHistory(history, zones, 'missing'), []);
    assert.equal(searchLogHistory(history, zones, '   '), history);
    assert.equal(summarizeLogSeries(selectLogSeries(history, selection)).change, 13);
    assert.equal(history.length, 5);
});

test('history keeps the best parse per report and encounter without losing older, lower parses', () => {
    const reports = [
        report('new', 3000, [boss(1, 3, { dps: [parse(76)] })]),
        report('old', 1000, [boss(1, 3, { dps: [parse(42)] }), boss(1, 3, { dps: [parse(47)] })]),
        report('middle', 2000, [boss(1, 3, { dps: [parse(88)] })]),
    ];
    const original = structuredClone(reports);
    const history = collectPlayerLogHistory(reports).get('Preview/Sailor');
    assert.deepEqual(history.map(entry => [entry.reportCode, entry.log]), [['old', 47], ['middle', 88], ['new', 76]]);
    assert.equal(history[0].reportTitle, 'old');
    assert.deepEqual(reports, original);
    const summary = summarizeLogSeries(selectLogSeries(history, selection));
    assert.equal(summary.first.log, 47);
    assert.equal(summary.latest.log, 76);
    assert.equal(summary.best.log, 88);
    assert.equal(summary.change, 29);
});

test('characters, realms, bosses, raids, roles and difficulties are kept separate', () => {
    const reports = [
        report('one', 1000, [
            boss(1, 3, { dps: [parse(50), parse(99, 'Sailor', 'Other'), parse(98, 'Another')], healers: [parse(82)], tanks: [parse(77)] }),
            boss(2, 3, { dps: [parse(92)] }),
            boss(1, 4, { dps: [parse(64)] }),
        ]),
        report('other-raid', 2000, [boss(1, 3, { dps: [parse(91)] })], 2),
    ];
    const histories = collectPlayerLogHistory(reports);
    const history = histories.get('Preview/Sailor');
    assert.equal(histories.size, 3);
    assert.deepEqual(selectLogSeries(history, selection).map(entry => entry.log), [50]);
    assert.deepEqual(selectLogSeries(history, { ...selection, role: 'healers' }).map(entry => entry.log), [82]);
    assert.deepEqual(selectLogSeries(history, { ...selection, role: 'tanks' }).map(entry => entry.log), [77]);
    assert.deepEqual(selectLogSeries(history, { ...selection, difficulty: 4 }).map(entry => entry.log), [64]);
    assert.deepEqual(selectLogSeries(history, { ...selection, bossId: 2 }).map(entry => entry.log), [92]);
    assert.deepEqual(selectLogSeries(history, { ...selection, zoneId: 2 }).map(entry => entry.log), [91]);
});

test('zero is a valid parse; missing and invalid results and unfinished reports are excluded', () => {
    const history = collectPlayerLogHistory([
        report('valid', 1000, [boss(1, 3, { dps: [-1, NaN, Infinity, null, undefined, 101, -5, 0].map(value => parse(value)) })]),
        report('absent', 2000, [boss()]),
        report('unfinished', 0, [boss(1, 3, { dps: [parse(80)] })]),
        report('invalid-time', NaN, [boss(1, 3, { dps: [parse(80)] })]),
    ]).get('Preview/Sailor');
    assert.deepEqual(history.map(entry => entry.log), [0]);
    assert.equal(selectLogSeries(history, selection).length, 1);
});

test('series are chronological without mutating history and changes can be negative or unchanged', () => {
    const history = collectPlayerLogHistory([
        report('later', 2000, [boss(1, 3, { dps: [parse(35)] })]),
        report('first', 1000, [boss(1, 3, { dps: [parse(80)] })]),
    ]).get('Preview/Sailor').reverse();
    const series = selectLogSeries(history, selection);
    assert.deepEqual(history.map(entry => entry.reportCode), ['later', 'first']);
    assert.equal(summarizeLogSeries(series).change, -45);
    assert.equal(summarizeLogSeries(series.slice(0, 1)).change, 0);
    assert.equal(summarizeLogSeries([]), undefined);
    assert.deepEqual(selectLogSeries(history, { ...selection, bossId: 99 }), []);
});
