import { SocketDTO } from "./SocketDTO";
import type { ItemAppearance } from './CharacterAppearance';

export interface EquipmentDTO {
    appearance?: ItemAppearance;
    id: number;
    name: string;
    slot: string;
    quality: string;
    armor?: number;
    transmog?: string;
    socketBonus?: string;
    itemClass: string;
    itemSubclass: string;
    inventoryType: string;
    stats: string[];
    bonusStats: string[];
    requirements: string[];
    spells: string[];
    enchant?: string;
    sockets: SocketDTO[];
    itemLevel: number;
    media: string;
}
