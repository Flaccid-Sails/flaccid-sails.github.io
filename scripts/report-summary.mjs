function bestLogs(bosses, select) {
    const byCharacter = new Map();
    for (const boss of bosses) {
        for (const log of select(boss)) {
            const key = `${log.realm}/${log.name}`;
            const current = byCharacter.get(key);
            if (!current) {
                byCharacter.set(key, { name: log.name, realm: log.realm, log: log.log });
            } else {
                current.log = Math.max(current.log, log.log);
            }
        }
    }
    return [...byCharacter.values()];
}

export function summarizeReports(reports, zones) {
    const names = new Map(zones.flatMap(zone => zone.bosses.map(boss => [boss.id, boss.name])));
    const difficulties = new Map();
    for (const report of reports) {
        for (const boss of report.bosses) {
            difficulties.set(boss.id, Math.max(difficulties.get(boss.id) ?? 0, boss.difficulty));
        }
    }
    const highestDifficulty = Math.max(0, ...difficulties.values());
    return [...difficulties].filter(([, difficulty]) => difficulty === highestDifficulty).map(([id, difficulty]) => {
        const kills = reports.flatMap(report => report.bosses)
            .filter(boss => boss.id === id && boss.difficulty === difficulty);
        const dps = bestLogs(kills, boss => boss.dps);
        const tanks = bestLogs(kills, boss => boss.tanks);
        const healers = bestLogs(kills, boss => boss.healers);
        return {
            id, name: names.get(id) ?? 'Unknown', difficulty,
            dps, tanks, healers,
        };
    });
}
