export interface CharacterAppearance {
    race: number;
    sex: 'm' | 'f';
    skin?: number;
    face?: number;
    hair?: number;
    hairColor?: number;
    facialHair?: number;
}

/** Tortoise DB's ItemDisplayInfo fields, resolved by item ID when collecting equipment. */
export interface ItemAppearance {
    display_id: number;
    inv: number;
    model_l?: string;
    model_r?: string;
    per_race?: number;
    tex_l?: string;
    tex_r?: string;
    geo1?: number;
    geo2?: number;
    geo3?: number;
    helm_m?: number;
    helm_f?: number;
    t_arm_u?: string;
    t_arm_l?: string;
    t_hand?: string;
    t_torso_u?: string;
    t_torso_l?: string;
    t_leg_u?: string;
    t_leg_l?: string;
    t_foot?: string;
}
