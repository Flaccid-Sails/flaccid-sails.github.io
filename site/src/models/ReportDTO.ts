import { ReportBossDTO } from './ReportBossDTO';

export interface ReportDTO {
    code: string;
    title: string;
    endTime: number;
    zoneId: number;
    bosses: ReportBossDTO[];
}