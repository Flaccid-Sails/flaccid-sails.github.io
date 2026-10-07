import { BossDTO } from './BossDTO';

export interface ZoneDTO {
    id: number;
    name: string;
    bosses: BossDTO[];
}