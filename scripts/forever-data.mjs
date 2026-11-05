import { planCharacterRefresh } from './collection-policy.mjs';

const number = (value, fallback = 0) => {
    const result = typeof value === 'number' ? value : value?.effective ?? value?.value;
    return Number.isFinite(result) ? result : fallback;
};
const classNames = { 1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue', 5: 'Priest', 7: 'Shaman', 8: 'Mage', 9: 'Warlock', 11: 'Druid' };
const classIcons = { Warrior: 'class_warrior', Paladin: 'class_paladin', Hunter: 'class_hunter', Rogue: 'class_rogue', Priest: 'class_priest', Shaman: 'class_shaman', Mage: 'class_mage', Warlock: 'class_warlock', Druid: 'class_druid' };

export function characterName(character) {
    return [character.name, character.surname].filter(Boolean).join(' ');
}

export function characterSlug(character) {
    if (character.slug) return character.slug;
    // Prefer Blizzard's canonical spelling, as the old worker did, while keeping
    // Forever's realmless route rather than extracting a Classic realm segment.
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
        powerType: data.power_type?.name,
    };
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

export function sameGuild(snapshot, configuration) {
    return snapshot?.mode === 'live' && snapshot.guild?.id === configuration.guildId &&
        snapshot.guild.region === configuration.region && snapshot.guild.ruleset === configuration.ruleset;
}

export async function collectForever({ client, configuration, policy, previous, profiles = {}, now = Date.now() }) {
    const path = `/data/wow/guild/${encodeURIComponent(configuration.guildSlug)}`;
    const optional = async url => {
        try { return await client.get(url); }
        catch (error) { if ([403, 404].includes(error.status)) return undefined; throw error; }
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
    }
    const cache = Object.fromEntries(players.flatMap(player => {
        const key = `${player.realm}/${player.name}`;
        const saved = characterProfiles[key];
        return saved ? [[key, { fetchedAt: saved.fetchedAt, lastLogin: player.lastLogin > 0 ? player.lastLogin : now }]] : [];
    }));
    const refreshCandidates = planCharacterRefresh(players, cache, policy, now);
    // Never guess another game's API or call Warcraft Logs. Missing Blizzard
    // character endpoints only defer that character; an absent guild roster is not empty membership.
    for (const player of refreshCandidates) {
        const characterPath = `/profile/wow/character/${encodeURIComponent(player.slug)}`;
        const summary = await optional(characterPath);
        if (!summary || summary.id !== player.id || summary.guild?.id !== configuration.guildId) continue;
        Object.assign(player, mapPlayer(summary, { rank: player.rank, ruleset: configuration.ruleset, previous: player }));
        const equipment = await optional(summary.equipment?.href ?? `${characterPath}/equipment`);
        const statistics = await optional(summary.statistics?.href ?? `${characterPath}/statistics`);
        if (!equipment || !statistics) continue;
        const media = new Map();
        for (const item of equipment.equipped_items ?? []) {
            if (!item.media?.key?.href || media.has(item.item.id)) continue;
            const result = await optional(item.media.key.href);
            const icon = result?.assets?.find(asset => asset.key === 'icon')?.value;
            if (icon && /^https:\/\/(?:[^/]+\.blizzard\.com|render\.worldofwarcraft\.com)\//.test(icon)) media.set(item.item.id, icon);
        }
        characterProfiles[`${player.realm}/${player.name}`] = {
            equipment: mapEquipment(equipment, media), statistics: mapStatistics(statistics),
            logHistory: [], fetchedAt: now,
        };
        player.equipmentAvailable = true;
    }
    return {
        players, profiles: characterProfiles,
        guild: { id: configuration.guildId, slug: configuration.guildSlug,
            name: guild?.name ?? (matchingPrevious ? previous.guild.name : configuration.guildName),
            region: configuration.region, ruleset: configuration.ruleset },
        parameters: { maxLevel: 60, minimumRaidItemLevel: 60,
            lastUpdate: roster ? now / 1000 : hasSavedRoster ? previous.parameters.lastUpdate : undefined },
        sources: { blizzard: { roster: roster ? 'available' : hasSavedRoster ? 'cached' : 'unavailable', checkedAt: new Date(now).toISOString() },
            warcraftLogs: { status: 'unavailable' } },
    };
}
