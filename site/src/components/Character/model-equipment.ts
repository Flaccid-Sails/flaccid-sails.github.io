import type { CharacterAppearance, ItemAppearance } from '../../models/CharacterAppearance';
import type { EquipmentDTO } from '../../models/EquipmentDTO';

const visibleSlots: Record<string, number[]> = {
    HEAD: [1], SHOULDER: [3], SHIRT: [4], CHEST: [5, 20], WAIST: [6], LEGS: [7],
    FEET: [8], WRIST: [9], HANDS: [10], BACK: [16], TABARD: [19],
    MAIN_HAND: [13, 17, 21], OFF_HAND: [13, 14, 22, 23], RANGED: [15, 25, 26],
};
const names = ['model_l', 'model_r', 'tex_l', 'tex_r', 't_arm_u', 't_arm_l', 't_hand',
    't_torso_u', 't_torso_l', 't_leg_u', 't_leg_l', 't_foot'] as const;
const numbers = ['display_id', 'inv', 'per_race', 'geo1', 'geo2', 'geo3', 'helm_m', 'helm_f'] as const;

export function validCharacterAppearance(appearance?: CharacterAppearance): appearance is CharacterAppearance {
    return Boolean(appearance && Number.isInteger(appearance.race) && appearance.race >= 1 && appearance.race <= 10 &&
        ['m', 'f'].includes(appearance.sex) &&
        ['skin', 'face', 'hair', 'hairColor', 'facialHair'].every(key => {
            const value = appearance[key as keyof CharacterAppearance];
            return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 256);
        }));
}

export function modelEquipment(equipment: EquipmentDTO[]) {
    const items: (ItemAppearance & { entry: number; slot?: string })[] = [];
    let missing = 0;
    for (const item of equipment) {
        const types = visibleSlots[item.slot];
        if (!types) continue; // Rings, trinkets, necklaces and relics have no visible model.
        if (item.slot === 'RANGED' && (item.appearance?.inv === 28 || item.inventoryType === 'RELIC')) continue;
        // The idle pose holds melee weapons; a ranged weapon must not overlap the off hand.
        if (item.slot === 'RANGED' && equipment.some(other => ['MAIN_HAND', 'OFF_HAND'].includes(other.slot))) continue;
        const appearance = item.appearance;
        if (!appearance || !types.includes(appearance.inv) || !Number.isSafeInteger(item.id) || item.id <= 0 ||
            !Number.isSafeInteger(appearance.display_id) || appearance.display_id <= 0 ||
            names.some(key => appearance[key] !== undefined && !/^[a-z0-9_]{0,128}$/i.test(appearance[key]!)) ||
            numbers.some(key => appearance[key] !== undefined && (!Number.isSafeInteger(appearance[key]) || appearance[key]! < 0))) {
            missing++;
            continue;
        }
        const clean: ItemAppearance = { display_id: appearance.display_id, inv: appearance.inv };
        for (const key of names) if (appearance[key] !== undefined) clean[key] = appearance[key];
        for (const key of numbers) if (appearance[key] !== undefined) clean[key] = appearance[key];
        items.push({ ...clean, entry: item.id, slot: item.slot.toLowerCase().replaceAll('_', '') });
    }
    return { items, missing };
}
