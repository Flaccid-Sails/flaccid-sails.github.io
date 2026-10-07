import { ReportLogDTO } from './ReportLogDTO';

export interface DashboardBossDTO {
    id: number;
    name: string;
    difficulty: number;
    maxDps: number;
    maxHps: number;
    dps: ReportLogDTO[];
    tanks: ReportLogDTO[];
    healers: ReportLogDTO[];
}
