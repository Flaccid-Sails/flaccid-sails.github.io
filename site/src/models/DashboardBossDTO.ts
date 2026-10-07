import { DashboardLogDTO } from './DashboardLogDTO';

export interface DashboardBossDTO {
    id: number;
    name: string;
    difficulty: number;
    dps: DashboardLogDTO[];
    tanks: DashboardLogDTO[];
    healers: DashboardLogDTO[];
}
