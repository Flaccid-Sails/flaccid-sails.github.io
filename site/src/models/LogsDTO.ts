import { LogsBossDTO } from "./LogsBossDTO";

export interface LogsDTO {
    healer?: number;
    dps?: number;
    tank?: number;
    rawHps?: number;
    rawDps?: number;
    difficulty?: number;
    killedBosses?: number;
    bosses?: LogsBossDTO[];
}