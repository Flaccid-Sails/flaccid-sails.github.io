import type { PlayerLogEntry, LogRole } from '../models/PlayerLogEntry';
import type { ReportDTO } from '../models/ReportDTO';
import type { ZoneDTO } from '../models/ZoneDTO';

export const logRoles: { value: LogRole; label: string }[] = [
    { value: 'dps', label: 'DPS' },
    { value: 'tanks', label: 'Tank DPS' },
    { value: 'healers', label: 'Healing' },
];

const validParse = (log: number) => Number.isFinite(log) && log >= 0 && log <= 100;

export function searchLogHistory(history: PlayerLogEntry[], zones: ZoneDTO[], query: string): PlayerLogEntry[] {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return history;
    const names = new Map(zones.flatMap(zone => zone.bosses.map(boss =>
        [`${zone.id}/${boss.id}`, `${zone.name} ${boss.name}`] as const)));
    return history.filter(entry => [names.get(`${entry.zoneId}/${entry.bossId}`) ?? `Boss ${entry.bossId}`, entry.reportTitle]
        .some(value => value.toLocaleLowerCase().includes(search)));
}

// Reports contain encounter summaries, so retain the best parse per report,
// boss, difficulty and role. A missing encounter never becomes a zero parse.
export function collectPlayerLogHistory(reports: ReportDTO[]): Map<string, PlayerLogEntry[]> {
    const players = new Map<string, Map<string, PlayerLogEntry>>();
    for (const report of reports) {
        if (!Number.isFinite(report.endTime) || report.endTime <= 0) continue;
        for (const boss of report.bosses) {
            for (const { value: role } of logRoles) {
                for (const parse of boss[role]) {
                    if (!validParse(parse.log)) continue;
                    const playerKey = `${parse.realm}/${parse.name}`;
                    let history = players.get(playerKey);
                    if (!history) players.set(playerKey, history = new Map());
                    const key = JSON.stringify([report.code, report.zoneId, boss.id, boss.difficulty, role]);
                    const previous = history.get(key);
                    if (!previous || parse.log > previous.log) history.set(key, {
                        reportCode: report.code, reportTitle: report.title, endTime: report.endTime,
                        zoneId: report.zoneId, bossId: boss.id, difficulty: boss.difficulty, role, log: parse.log,
                    });
                }
            }
        }
    }
    return new Map([...players].map(([key, history]) => [key, [...history.values()]
        .sort((a, b) => a.endTime - b.endTime || a.reportCode.localeCompare(b.reportCode))]));
}

export function selectLogSeries(history: PlayerLogEntry[], selection: {
    zoneId: number; bossId: number; difficulty: number; role: LogRole;
}): PlayerLogEntry[] {
    return history.filter(entry => entry.zoneId === selection.zoneId && entry.bossId === selection.bossId &&
        entry.difficulty === selection.difficulty && entry.role === selection.role && validParse(entry.log))
        .sort((a, b) => a.endTime - b.endTime || a.reportCode.localeCompare(b.reportCode));
}

export function summarizeLogSeries(series: PlayerLogEntry[]) {
    if (!series.length) return undefined;
    const first = series[0];
    const latest = series[series.length - 1];
    const best = series.reduce((best, entry) => entry.log > best.log ? entry : best);
    return { first, latest, best, change: latest.log - first.log };
}
