import { BlizzardError } from './blizzard-client.mjs';

const combatSlots = new Set([
    'HEAD', 'NECK', 'SHOULDER', 'BACK', 'CHEST', 'WRIST', 'HANDS', 'WAIST', 'LEGS', 'FEET',
    'FINGER_1', 'FINGER_2', 'TRINKET_1', 'TRINKET_2', 'MAIN_HAND', 'OFF_HAND', 'RANGED', 'RELIC',
]);

export function estimateEquippedItemLevel(equipment) {
    const gear = equipment?.filter(item => combatSlots.has(item.slot));
    if (!gear?.length || gear.some(item => !Number.isSafeInteger(item.itemLevel) || item.itemLevel <= 0)) return;
    const twoHander = gear.find(item => item.slot === 'MAIN_HAND' && item.inventoryType === 'Two-Hand');
    const twoHanded = twoHander && !gear.some(item => item.slot === 'OFF_HAND');
    const total = gear.reduce((sum, item) => sum + item.itemLevel, 0);
    return Math.floor(twoHanded ? (total + twoHander.itemLevel) / (gear.length + 1) : total / gear.length);
}

const weekMs = 7 * 24 * 60 * 60 * 1000;

function wowheadRetryAt(header) {
    const now = Date.now();
    const time = /^\d+$/.test(header) ? now + Number(header) * 1000 : Date.parse(header);
    return Number.isSafeInteger(time) && time > now ? time : now + 60 * 60 * 1000;
}

export function createCatalogItemLookup({ region, optional, useWowhead = true, fetchImpl = fetch, wowheadCache = new Map() }) {
    const levels = new Map();
    let blizzardAvailable = true;
    let wowheadAvailable = true;
    let retryAt;

    async function fromBlizzard(url, id) {
        if (!blizzardAvailable) return;
        try {
            const entry = await optional(url);
            const level = entry?.level?.value ?? entry?.level;
            if (entry?.id === id && Number.isSafeInteger(level) && level > 0)
                return { itemLevel: level, itemLevelSource: 'blizzard-catalog' };
        } catch (error) {
            if (!(error instanceof BlizzardError && error.transient && error.operation !== 'authentication')) throw error;
            blizzardAvailable = false;
            console.warn(`Skipping further Blizzard item catalog lookups this run. ${error.message}`);
        }
    }

    async function requestWowheadLevel(id) {
        let rateLimitedUntil;
        try {
            const response = await fetchImpl(`https://nether.wowhead.com/forever/tooltip/item/${id}`, {
                credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(5_000),
            });
            if (response.ok) {
                const { tooltip } = await response.json();
                if (typeof tooltip === 'string') {
                    const level = Number(/Item Level\s*<!--ilvl-->(\d+)</.exec(tooltip)?.[1]);
                    return Number.isSafeInteger(level) && level > 0 ? level : null;
                }
            } else {
                if (response.status === 429) rateLimitedUntil = wowheadRetryAt(response.headers.get('retry-after'));
                await response.body?.cancel();
                if (response.status === 404) return null;
            }
        } catch {
            // A tooltip service outage must not stop the equipment refresh.
        }
        wowheadAvailable = false;
        if (rateLimitedUntil !== undefined) await wowheadCache.set('retry-after', rateLimitedUntil);
        console.warn('Wowhead Forever tooltips are unavailable. Skipping further Wowhead lookups this run.');
    }

    async function fromWowhead(id) {
        if (!useWowhead) return;
        const cached = await wowheadCache.get(id);
        let level = cached?.level;
        if (wowheadAvailable && (!cached || Date.now() >= cached.checkedAt + weekMs)) {
            retryAt ??= await wowheadCache.get('retry-after') ?? 0;
            if (Date.now() >= retryAt) {
                const result = await requestWowheadLevel(id);
                if (result !== undefined) {
                    level = result;
                    await wowheadCache.set(id, { level, checkedAt: Date.now() });
                }
            }
        }
        if (Number.isSafeInteger(level) && level > 0) return { itemLevel: level, itemLevelSource: 'wowhead' };
    }

    return async ref => {
        if (!Number.isSafeInteger(ref.id) || ref.id <= 0) return;
        const path = `/data/wow/item/${ref.id}`;
        const link = URL.parse(ref.key?.href);
        const url = link?.origin === `https://${region}.api.blizzard.com` && link.pathname === path ? link.href : path;
        if (!levels.has(url)) {
            const value = await fromBlizzard(url, ref.id) ?? await fromWowhead(ref.id);
            levels.set(url, value);
        }
        return levels.get(url);
    };
}
