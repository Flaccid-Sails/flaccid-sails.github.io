export type LogRole = 'dps' | 'tanks' | 'healers';

export interface PlayerLogEntry {
    reportCode: string;
    reportTitle: string;
    endTime: number;
    zoneId: number;
    bossId: number;
    difficulty: number;
    role: LogRole;
    log: number;
}
