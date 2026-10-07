import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoTalentBuild } from './demo-talents.mjs';

const catalog = JSON.parse(await readFile(new URL('../data/talents.json', import.meta.url), 'utf8'));

test('sample builds respect level budgets, rank limits, tier gates and prerequisites for every class', () => {
    for (const [name, characterClass] of Object.entries(catalog.classes)) {
        for (const level of [9, 10, 16, 23, 37, 51, 60]) {
            for (const primaryTree of [0, 1, 2]) {
                const { ranks } = createDemoTalentBuild(characterClass, level, primaryTree);
                assert.equal(Object.values(ranks).reduce((sum, rank) => sum + rank, 0), Math.max(0, level - 9), `${name} level ${level}`);
                for (const tree of characterClass.trees) {
                    for (const talent of tree.talents) {
                        const rank = ranks[`${tree.name}/${talent.name}`] ?? 0;
                        assert.ok(Number.isInteger(rank) && rank >= 0 && rank <= talent.max);
                        if (!rank) continue;
                        const lowerPoints = tree.talents.filter(candidate => candidate.row < talent.row)
                            .reduce((sum, candidate) => sum + (ranks[`${tree.name}/${candidate.name}`] ?? 0), 0);
                        assert.ok(lowerPoints >= (talent.row - 1) * 5, `${name}: ${talent.name} tier gate`);
                        if (talent.prerequisite) {
                            const prerequisite = tree.talents.find(candidate => candidate.name === talent.prerequisite);
                            assert.equal(ranks[`${tree.name}/${prerequisite.name}`], prerequisite.max, `${name}: ${talent.name} prerequisite`);
                        }
                    }
                }
            }
        }
    }
});
