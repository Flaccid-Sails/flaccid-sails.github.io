import { ParametersDTO } from './ParametersDTO';
import { PlayerApiDTO } from './PlayerApiDTO';
import { LogsDTO } from './LogsDTO';
import { ZoneDTO } from './ZoneDTO';

export interface Snapshot {
    schemaVersion: 2;
    generatedAt: string;
    parameters: ParametersDTO;
    players: PlayerApiDTO[];
    logs: Record<string, LogsDTO>;
    zones: ZoneDTO[];
    mode: 'demo';
    characterIndexFile: string;
    reportIndexFile: string;
    dashboardFile: string;
    talentCatalogFile: string;
}
