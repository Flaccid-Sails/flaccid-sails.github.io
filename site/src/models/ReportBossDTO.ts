import { ReportLogDTO } from './ReportLogDTO';

export interface ReportBossDTO {
    id: number;
    difficulty: number;
    dps: ReportLogDTO[];
    tanks: ReportLogDTO[];
    healers: ReportLogDTO[];
}