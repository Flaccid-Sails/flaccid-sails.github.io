import { createHash } from 'node:crypto';

export const SOURCE_URL = 'https://talentsforever.com/data.json';
export const CLASS_NAMES = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid'];
const check = (condition, message) => { if (!condition) throw new Error(`Invalid talent data: ${message}`); };
const text = value => typeof value === 'string' && value.trim().length > 0;

export function normalizeTalents(raw) {
    check(raw?.license === 'CC-BY-4.0', 'source license changed');
    check(text(raw.generated) && Number.isFinite(Date.parse(raw.generated)), 'missing source date');
    check(raw.talents && typeof raw.talents === 'object', 'missing classes');
    const classes = {};
    for (const className of CLASS_NAMES) {
        const source = raw.talents[className];
        check(source && Array.isArray(source.trees) && source.trees.length === 3, `${className} needs three trees`);
        check(text(source.icon) && /^[a-z0-9_]+$/i.test(source.icon), `${className} icon`);
        check(text(source.source), `${className} needs provenance`);
        const treeNames = new Set();
        classes[className] = {
            icon: source.icon,
            source: source.source,
            trees: source.trees.map(tree => {
                check(text(tree.name) && !treeNames.has(tree.name), 'invalid or duplicate tree name');
                treeNames.add(tree.name);
                check(text(tree.icon) && /^[a-z0-9_]+$/i.test(tree.icon), `${tree.name} icon`);
                check(Array.isArray(tree.talents) && tree.talents.length >= 10, `incomplete ${className} ${tree.name}`);
                const names = new Set();
                const positions = new Set();
                const talents = tree.talents.map(talent => {
                    check(text(talent.name) && !names.has(talent.name), 'invalid or duplicate talent');
                    names.add(talent.name);
                    check(Number.isInteger(talent.max) && talent.max >= 1 && talent.max <= 10, `${talent.name} ranks`);
                    check(Number.isInteger(talent.row) && talent.row >= 1 && talent.row <= 10, `${talent.name} row`);
                    check(Number.isInteger(talent.col) && talent.col >= 1 && talent.col <= 4, `${talent.name} column`);
                    const position = `${talent.row}/${talent.col}`;
                    check(!positions.has(position), `duplicate grid position in ${tree.name}`);
                    positions.add(position);
                    check(Array.isArray(talent.desc) && talent.desc.length === talent.max && talent.desc.every(text), `${talent.name} descriptions`);
                    check(text(talent.icon) && /^[a-z0-9_]+$/i.test(talent.icon), `${talent.name} icon`);
                    check(!talent.req || text(talent.req), `${talent.name} prerequisite`);
                    return {
                        name: talent.name, max: talent.max, row: talent.row, col: talent.col,
                        icon: talent.icon, descriptions: talent.desc,
                        ...(talent.req ? { prerequisite: talent.req } : {}),
                        ...(talent.cost ? { cost: talent.cost } : {}),
                        status: talent.classic?.status ?? 'unknown',
                    };
                });
                for (const talent of talents) {
                    check(!talent.prerequisite || names.has(talent.prerequisite), `${talent.name} missing prerequisite`);
                }
                return { name: tree.name, icon: tree.icon, talents };
            }),
        };
    }
    return { sourceGeneratedAt: raw.generated, classes };
}

export const contentHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createCatalog(raw, previous, now = new Date().toISOString()) {
    const data = normalizeTalents(raw);
    const hash = contentHash(data);
    return {
        schemaVersion: 1,
        checkedAt: now,
        changedAt: previous?.contentHash === hash ? previous.changedAt : now,
        contentHash: hash,
        ...data,
    };
}
