import { LogsBossDTO } from "./LogsBossDTO";

export interface LogsDTO {
    healer?: number;
    dps?: number;
    tank?: number;
    difficulty?: number;
    killedBosses?: number;
    bosses?: LogsBossDTO[];
}
