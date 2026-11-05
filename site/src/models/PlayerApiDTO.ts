import type { CharacterAppearance } from './CharacterAppearance';

export interface PlayerApiDTO {
    id?: number;
    slug?: string;
    equipmentAvailable?: boolean;
    talentsAvailable?: boolean;
    warcraftLogsUrl?: string;
    appearance?: CharacterAppearance;
    name: string;
    realm: string;
    equippedItemLevel: number;
    itemLevel: number;
    class: string;
    rank: number;
    achievementPoints: number;
    lastLogin: number;
    level: number;
    image: string;
}
