export interface TalentBuild {
    name: string;
    ranks: Record<string, number>;
}

export interface Talent {
    name: string;
    max: number;
    row: number;
    col: number;
    icon: string;
    descriptions: string[];
    prerequisite?: string;
    cost?: string;
    status: string;
}

export interface TalentTree {
    name: string;
    icon: string;
    talents: Talent[];
}

export interface TalentCatalog {
    schemaVersion: 1;
    checkedAt: string;
    changedAt: string;
    sourceGeneratedAt: string;
    contentHash: string;
    classes: Record<string, { icon: string; source: string; trees: TalentTree[] }>;
}
