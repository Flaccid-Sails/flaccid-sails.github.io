export interface EquipmentSlot {
    key: string;
    label: string;
    emptyIcon: string;
    aliases?: string[];
}

export const characterAsset = (path: string) => `${import.meta.env.BASE_URL}assets/character-window/${path}`;

export const leftEquipmentSlots: EquipmentSlot[] = [
    { key: 'HEAD', label: 'Head', emptyIcon: 'head' },
    { key: 'NECK', label: 'Neck', emptyIcon: 'neck' },
    { key: 'SHOULDER', label: 'Shoulders', emptyIcon: 'shoulder' },
    { key: 'BACK', label: 'Back', emptyIcon: 'chest' },
    { key: 'CHEST', label: 'Chest', emptyIcon: 'chest' },
    { key: 'SHIRT', label: 'Shirt', emptyIcon: 'shirt' },
    { key: 'TABARD', label: 'Tabard', emptyIcon: 'tabard' },
    { key: 'WRIST', label: 'Wrists', emptyIcon: 'wrists' },
];

export const rightEquipmentSlots: EquipmentSlot[] = [
    { key: 'HANDS', label: 'Hands', emptyIcon: 'hands' },
    { key: 'WAIST', label: 'Waist', emptyIcon: 'waist' },
    { key: 'LEGS', label: 'Legs', emptyIcon: 'legs' },
    { key: 'FEET', label: 'Feet', emptyIcon: 'feet' },
    { key: 'FINGER_1', label: 'Finger 1', emptyIcon: 'finger' },
    { key: 'FINGER_2', label: 'Finger 2', emptyIcon: 'finger' },
    { key: 'TRINKET_1', label: 'Trinket 1', emptyIcon: 'trinket' },
    { key: 'TRINKET_2', label: 'Trinket 2', emptyIcon: 'trinket' },
];

export function weaponEquipmentSlots(characterClass: string): EquipmentSlot[] {
    const relics: Record<string, string> = { Paladin: 'Libram', Shaman: 'Totem', Druid: 'Idol' };
    const relic = relics[characterClass];
    const wand = ['Mage', 'Priest', 'Warlock'].includes(characterClass);
    return [
        { key: 'MAIN_HAND', label: 'Main Hand', emptyIcon: 'mainhand' },
        { key: 'OFF_HAND', label: 'Off Hand', emptyIcon: 'secondaryhand' },
        { key: 'RANGED', label: relic ?? (wand ? 'Wand' : 'Ranged'), emptyIcon: relic ? 'relic' : 'ranged', aliases: relic ? ['RELIC'] : undefined },
    ];
}
