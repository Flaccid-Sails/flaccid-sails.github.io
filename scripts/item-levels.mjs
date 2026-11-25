import { BlizzardError } from './blizzard-client.mjs';

export function createCatalogItemLookup({ region, optional, useWowhead, fetchImpl = fetch }) {
    const levels = new Map();
    let blizzardAvailable = true;
    let wowheadAvailable = useWowhead;

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

    async function fromWowhead(id) {
        if (!wowheadAvailable) return;
        try {
            const response = await fetchImpl(`https://nether.wowhead.com/forever/tooltip/item/${id}`, {
                credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(5_000),
            });
            if (response.ok) {
                const { tooltip } = await response.json();
                const level = typeof tooltip === 'string' && Number(/Item Level\s*<!--ilvl-->(\d+)</.exec(tooltip)?.[1]);
                if (Number.isSafeInteger(level) && level > 0) return { itemLevel: level, itemLevelSource: 'wowhead' };
                return;
            }
            await response.body?.cancel();
            if (response.status === 404) return;
        } catch {
            // A tooltip service outage must not stop the equipment refresh.
        }
        wowheadAvailable = false;
        console.warn('Wowhead Forever tooltips are unavailable. Skipping further Wowhead lookups this run.');
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
