export function createDemoTalentBuild(characterClass, level, primaryTree = 0) {
    const ranks = {};
    const trees = characterClass.trees;
    const order = trees.map((_, index) => (primaryTree + index) % trees.length);
    const spent = trees.map(() => 0);
    const budget = Math.max(0, Math.min(level, 60) - 9);

    for (let point = 0; point < budget; point++) {
        const preferred = spent[order[0]] >= 31 ? [order[1], order[0], order[2]] : order;
        let allocated = false;
        for (const index of preferred) {
            const tree = trees[index];
            const available = tree.talents.filter(talent => {
                const rank = ranks[`${tree.name}/${talent.name}`] ?? 0;
                const prerequisite = tree.talents.find(candidate => candidate.name === talent.prerequisite);
                return rank < talent.max && spent[index] >= (talent.row - 1) * 5
                    && (!prerequisite || ranks[`${tree.name}/${prerequisite.name}`] === prerequisite.max);
            }).sort((a, b) => b.row - a.row || a.col - b.col);
            if (!available.length) continue;
            const key = `${tree.name}/${available[0].name}`;
            ranks[key] = (ranks[key] ?? 0) + 1;
            spent[index]++;
            allocated = true;
            break;
        }
        if (!allocated) break;
    }
    return { name: 'Primary', ranks };
}
