export interface ReportIndexEntry {
    code: string;
    title: string;
    endTime: number;
    zoneId: number;
    bosses: { id: number; difficulty: number }[];
    file: string;
}
