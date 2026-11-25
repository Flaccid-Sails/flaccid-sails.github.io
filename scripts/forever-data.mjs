import { createHash } from 'node:crypto';
import { BlizzardError } from './blizzard-client.mjs';
import { createCatalogItemLookup } from './item-levels.mjs';
import { planCharacterRefresh } from './collection-policy.mjs';

const number = (value, fallback = 0) => {
    const result = typeof value === 'number' ? value : value?.effective ?? value?.value;
    return Number.isFinite(result) ? result : fallback;
};
const classNames = { 1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 11: 'Druid' };
const classIcons = { Warrior: 'class_warrior', Paladin: 'class_paladin', Hunter: 'class_hunter', Rogue: 'class_rogue', Priest: 'class_priest', Shaman: 'class_shaman', Mage: 'class_mage', Warlock: 'class_warlock', Druid: 'class_druid' };
const detailsVersion = 5;

export function characterName(character) {
    return [character.name, character.surname].filter(Boolean).join(' ');
}

export function characterSlug(character) {
    if (character.slug) return character.slug;
    if (character.key?.href) {
        const path = new URL(character.key.href).pathname;
        const match = /^\/profile\/wow\/character\/([^/]+)$/.exec(path);
        if (match) return decodeURIComponent(match[1]);
    }
    return characterName(character).toLowerCase().replaceAll(' ', '-');
}

export function mapPlayer(character, { rank = -1, ruleset = 'PvE', previous = {} } = {}) {
    const name = characterName(character);
    const characterClass = character.character_class?.name ?? character.playable_class?.name ??
        classNames[character.playable_class?.id ?? character.character_class?.id] ?? previous.class ?? 'Unknown';
    if (!name || !Number.isInteger(character.id)) throw new Error('Blizzard returned an invalid roster character.');
    return {
        ...previous,
        id: character.id, slug: characterSlug(character), name, realm: ruleset, class: characterClass,
        level: number(character.level), rank,
        equippedItemLevel: number(character.equipped_item_level, previous.equippedItemLevel ?? -1),
        itemLevel: number(character.average_item_level, previous.itemLevel ?? -1),
        achievementPoints: number(character.achievement_points),
        lastLogin: number(character.last_login_timestamp, previous.lastLogin ?? -1),
        image: classIcons[characterClass] ? `icons/${classIcons[characterClass]}.webp` : '',
        equipmentAvailable: previous.equipmentAvailable ?? false,
        talentsAvailable: false,
    };
}

export function mapStatistics(data) {
    const fields = ['health', 'power', 'strength', 'agility', 'intellect', 'stamina', 'melee_crit', 'melee_haste',
        'mastery', 'bonus_armor', 'attack_power', 'main_hand_damage_min', 'main_hand_damage_max', 'main_hand_speed',
        'main_hand_dps', 'off_hand_damage_min', 'off_hand_damage_max', 'off_hand_speed', 'off_hand_dps',
        'spell_power', 'spell_penetration', 'spell_crit', 'mana_regen', 'mana_regen_combat', 'armor', 'dodge',
        'parry', 'block', 'ranged_crit', 'ranged_haste', 'spell_haste', 'spirit'];
    return {
        ...Object.fromEntries(fields.map(field => [field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), number(data[field])])),
        ...Object.fromEntries(['movement_speed', 'ranged_attack_power', 'expertise', 'melee_hit', 'spell_hit', 'ranged_hit']
            .filter(field => data[field] != null)
            .map(field => [field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), number(data[field])])),
        powerType: data.power_type?.name,
    };
}

function characterAsset(media, playerId, keys) {
    if (media?.character?.id !== playerId || !Array.isArray(media.assets)) return undefined;
    for (const key of keys) {
        const value = media.assets.find(asset => asset.key === key)?.value;
        if (typeof value === 'string' && /^https:\/\/render\.worldofwarcraft\.com\/[\w./-]+\.(png|jpe?g|webp)$/i.test(value))
            return value;
    }
}

export function characterRender(media, playerId, raceId) {
    const keys = raceId === 5 ? ['main-sd-raw', 'main-raw', 'main'] : ['main-raw', 'main-sd-raw', 'main'];
    return characterAsset(media, playerId, keys);
}

export function characterTalents(data, playerId) {
    if (data?.character?.id !== playerId || !Array.isArray(data.specialization_groups)) return undefined;
    const builds = [];
    for (const group of data.specialization_groups) {
        if (!Array.isArray(group?.specializations) || !group.specializations.length) continue;
        const ranks = {};
        let complete = true;
        for (const spec of group.specializations) {
            const tree = spec?.specialization_name || spec?.specialization?.name;
            if (typeof tree !== 'string' || (spec.talents != null && !Array.isArray(spec.talents))) {
                complete = false;
                break;
            }
            let points = 0;
            for (const entry of spec.talents ?? []) {
                const name = entry?.talent?.name ?? entry?.spell_tooltip?.spell?.name;
                const rank = entry?.talent_rank;
                if (typeof name !== 'string' || !name || !Number.isInteger(rank) || rank < 1 || ranks[`${tree}/${name}`]) {
                    complete = false;
                    break;
                }
                ranks[`${tree}/${name}`] = rank;
                points += rank;
            }
            if (points !== spec.spent_points) complete = false;
        }
        if (complete) builds.push({ name: group.is_active ? 'Active' : 'Alternate', ranks });
    }
    return builds.length ? builds.sort((a, b) => Number(b.name === 'Active') - Number(a.name === 'Active')) : undefined;
}

export function mapEquipment(data, media = new Map()) {
    if (!Array.isArray(data.equipped_items)) throw new Error('Blizzard returned invalid equipment.');
    return data.equipped_items.map(item => {
        const enchantments = item.enchantments ?? [];
        const enchant = enchantments.find(value => value.display_string?.startsWith('Enchanted: '));
        return {
            id: item.item.id, name: item.name, slot: item.slot.type,
            quality: item.quality?.type ?? 'COMMON', armor: item.armor?.value,
            transmog: item.transmog?.display_string,
            socketBonus: enchantments.find(value => value.enchantment_slot?.id === 5)?.display_string?.replace(/^Socket Bonus:\s*/, ''),
            itemClass: item.item_class?.name ?? '', itemSubclass: item.item_subclass?.name ?? '',
            inventoryType: item.inventory_type?.name ?? item.slot.name,
            stats: [item.weapon?.damage?.display_string, item.weapon?.attack_speed?.display_string,
            item.weapon?.dps?.display_string, ...(item.stats ?? []).map(stat => stat.display?.display_string)].filter(Boolean),
            bonusStats: [], requirements: Object.values(item.requirements ?? {}).map(value => value.display_string).filter(Boolean),
            spells: (item.spells ?? []).map(spell => spell.description).filter(Boolean),
            enchant: enchant?.display_string.slice('Enchanted: '.length),
            sockets: enchantments.filter(value => value.source_item && !value.display_string?.startsWith('Enchanted: '))
                .map(value => ({ id: value.source_item.id, display: value.display_string, media: media.get(value.source_item.id) ?? '' })),
            itemLevel: number(item.level, -1), media: media.get(item.item.id) ?? '',
        };
    });
}

function gearFingerprint(items) {
    if (!Array.isArray(items)) throw new Error('Blizzard returned invalid equipment.');
    const slots = items.map(item => [
        item.slot.type, item.item.id, number(item.level), item.modified_appearance_id,
        item.transmog?.item?.id, item.transmog?.appearance?.id, item.transmog?.item_modified_appearance_id, item.transmog?.display_string,
        (item.bonus_list ?? []).toSorted((a, b) => a - b),
        (item.sockets ?? []).map(socket => [socket.socket_type?.type, socket.item?.id]),
        (item.enchantments ?? []).map(enchant => [enchant.enchantment_slot?.id, enchant.enchantment_id,
            enchant.source_item?.id, enchant.display_string]).sort(),
    ]).sort(([a], [b]) => a.localeCompare(b));
    return createHash('sha256').update(JSON.stringify(slots)).digest('hex');
}

export function sameGuild(snapshot, configuration) {
    return snapshot?.mode === 'live' && snapshot.guild?.id === configuration.guildId &&
        snapshot.guild.region === configuration.region && snapshot.guild.ruleset === configuration.ruleset;
}

async function refreshCharacter(rosterPlayer, characterProfiles, optional, lookupItemLevel, configuration, now) {
    const characterPath = `/profile/wow/character/${encodeURIComponent(rosterPlayer.slug)}`;
    const summary = await optional(characterPath);
    if (!summary || summary.id !== rosterPlayer.id || summary.guild?.id !== configuration.guildId) return;
    const player = mapPlayer(summary, { rank: rosterPlayer.rank, ruleset: configuration.ruleset, previous: rosterPlayer });
    const key = `${player.realm}/${player.name}`;
    const saved = characterProfiles[key];
    const talentBuilds = characterTalents(await optional(summary.specializations?.href ?? `${characterPath}/specializations`), player.id);
    const characterMedia = await optional(summary.media?.href ?? `${characterPath}/character-media`);
    player.characterRender = characterRender(characterMedia, player.id, summary.race?.id);
    player.characterPortrait = characterAsset(characterMedia, player.id, ['avatar', 'avatar-sd']);
    player.talentsAvailable = Boolean(talentBuilds?.length);
    const equipment = await optional(summary.equipment?.href ?? `${characterPath}/equipment`);
    const statistics = await optional(summary.statistics?.href ?? `${characterPath}/statistics`);
    const profile = { ...saved, talentBuilds, logHistory: saved?.logHistory ?? [], fetchedAt: now, detailsVersion };
    if (equipment) {
        const fingerprint = gearFingerprint(equipment.equipped_items);
        if (fingerprint !== saved?.gearFingerprint) profile.gearChangedAt = now;
        profile.gearFingerprint = fingerprint;
    } else if (saved?.equipment) {
        profile.gearChangedAt ??= saved.fetchedAt;
    }
    if (equipment && statistics) {
        const media = new Map();
        for (const item of equipment.equipped_items ?? []) {
            if (!item.media?.key?.href || media.has(item.item.id)) continue;
            const result = await optional(item.media.key.href);
            const icon = result?.assets?.find(asset => asset.key === 'icon')?.value;
            if (icon && /^https:\/\/(?:[^/]+\.blizzard\.com|render\.worldofwarcraft\.com)\//.test(icon)) media.set(item.item.id, icon);
        }
        profile.equipment = mapEquipment(equipment, media);
        for (const [index, item] of profile.equipment.entries()) {
            if (item.itemLevel > 0) continue;
            const fallback = await lookupItemLevel(equipment.equipped_items[index].item);
            if (fallback) Object.assign(item, fallback);
        }
        profile.statistics = mapStatistics(statistics);
        player.equipmentAvailable = true;
    }
    return { key, player, profile };
}

export async function collectForever({ client, configuration, policy, previous, profiles = {}, now = Date.now() }) {
    const path = `/data/wow/guild/${encodeURIComponent(configuration.guildSlug)}`;
    const optional = async url => {
        try { return await client.get(url); }
        catch (error) {
            if (error instanceof BlizzardError && error.operation !== 'authentication' && [403, 404].includes(error.status)) return undefined;
            throw error;
        }
    };
    const guild = await optional(path);
    if (guild && guild.id !== configuration.guildId) throw new Error('The configured guild ID does not match Blizzard.');
    const roster = await optional(guild?.roster?.href ?? `${path}/roster`);
    if (roster && (!Array.isArray(roster.members) || roster.guild?.id !== configuration.guildId))
        throw new Error('Blizzard returned an invalid or mismatched guild roster.');
    const matchingPrevious = sameGuild(previous, configuration);
    const hasSavedRoster = matchingPrevious && previous.parameters.lastUpdate > 0;
    const previousPlayers = hasSavedRoster ? previous.players : [];
    const oldById = new Map(previousPlayers.map(player => [player.id, player]));
    const players = roster ? roster.members.map(member => mapPlayer(member.character, {
        rank: member.rank, ruleset: configuration.ruleset, previous: oldById.get(member.character.id),
    })) : previousPlayers;
    const characterProfiles = {};
    for (const player of players) {
        const key = `${player.realm}/${player.name}`;
        if (matchingPrevious && profiles[key]) characterProfiles[key] = profiles[key];
        player.equipmentAvailable = Boolean(characterProfiles[key]?.equipment && characterProfiles[key]?.statistics);
        player.talentsAvailable = Boolean(characterProfiles[key]?.talentBuilds?.length);
    }
    const cache = Object.fromEntries(players.flatMap(player => {
        const key = `${player.realm}/${player.name}`;
        const saved = characterProfiles[key];
        return saved?.detailsVersion === detailsVersion
            ? [[key, { fetchedAt: saved.fetchedAt, lastLogin: player.lastLogin > 0 ? player.lastLogin : now }]] : [];
    }));
    const lookupItemLevel = createCatalogItemLookup({ region: configuration.region, optional, useWowhead: policy.wowheadItemLevelFallback });
    const refreshCandidates = planCharacterRefresh(players, cache, policy, now);
    for (const player of refreshCandidates) {
        try {
            const refreshed = await refreshCharacter(player, characterProfiles, optional, lookupItemLevel, configuration, now);
            if (refreshed) {
                Object.assign(player, refreshed.player);
                characterProfiles[refreshed.key] = refreshed.profile;
            }
        } catch (error) {
            if (!(error instanceof BlizzardError && error.transient && error.operation !== 'authentication')) throw error;
            console.warn(`Deferred details for character ${player.id}. ${error.message}`);
        }
    }
    return {
        players, profiles: characterProfiles,
        guild: {
            id: configuration.guildId, slug: configuration.guildSlug,
            name: guild?.name ?? (matchingPrevious ? previous.guild.name : configuration.guildName),
            region: configuration.region, ruleset: configuration.ruleset
        },
        parameters: {
            maxLevel: 60, minimumRaidItemLevel: 60,
            lastUpdate: roster ? now / 1000 : hasSavedRoster ? previous.parameters.lastUpdate : undefined
        },
        sources: {
            blizzard: { roster: roster ? 'available' : hasSavedRoster ? 'cached' : 'unavailable', checkedAt: new Date(now).toISOString() },
            warcraftLogs: { status: 'unavailable' }
        },
    };
}
