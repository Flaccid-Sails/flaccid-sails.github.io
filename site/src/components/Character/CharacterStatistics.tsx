import { ReactNode } from 'react';
import { PlayerDTO } from '@src/models/PlayerDTO';
import { StatisticsDTO } from '@src/models/StatisticsDTO';
import { formatWithCommas } from '@src/utils/helpers';

type StatRow = [label: string, value: ReactNode];
const percent = (value: number | undefined) => value === undefined ? undefined : `${value.toFixed(2)}%`;
const damage = (min: number, max: number) => `${formatWithCommas(Math.floor(min))} - ${formatWithCommas(Math.floor(max))}`;

function StatSection({ title, rows }: { title: string; rows: StatRow[] }) {
    return <section className='character-stat-section' aria-label={title}>
        <h2>{title}</h2>
        <dl>{rows.filter(([, value]) => value !== undefined && value !== null && value !== false).map(([label, value]) =>
            <div className='character-stat-row' key={label}><dt>{label}:</dt><dd>{value}</dd></div>)}</dl>
    </section>;
}

export function CharacterStatistics({ player, statistics: s }: { player: PlayerDTO; statistics: StatisticsDTO }) {
    const castsSpells = !['Warrior', 'Rogue', 'Hunter'].includes(player.class);
    const usesRangedWeapon = ['Warrior', 'Rogue', 'Hunter'].includes(player.class);
    return <div>
        <StatSection title='General' rows={[
            ['Health', formatWithCommas(s.health)],
            [s.powerType ?? 'Power', s.powerType ? formatWithCommas(s.power) : undefined],
            ['Movement Speed', s.movementSpeed === undefined ? undefined : `${s.movementSpeed}%`],
            ['Item Level', player.equippedItemLevel >= 0 ? `${player.equippedItemLevel} / ${player.itemLevel}` : undefined],
        ]} />
        <StatSection title='Primary Attributes' rows={[
            ['Strength', formatWithCommas(s.strength)], ['Agility', formatWithCommas(s.agility)],
            ['Stamina', formatWithCommas(s.stamina)], ['Intellect', formatWithCommas(s.intellect)],
            ['Spirit', formatWithCommas(s.spirit)],
        ]} />
        <StatSection title='Weapons' rows={[
            ['Main Hand', damage(s.mainHandDamageMin, s.mainHandDamageMax)],
            ['Off Hand', s.offHandDamageMax > 0 ? damage(s.offHandDamageMin, s.offHandDamageMax) : undefined],
            ['Attack Power', formatWithCommas(s.attackPower)],
            ['Ranged Attack Power', s.rangedAttackPower === undefined ? undefined : formatWithCommas(s.rangedAttackPower)],
            ['Damage per Second', s.mainHandDps.toFixed(1)],
            ['Attack Speed', `${s.mainHandSpeed.toFixed(2)}${s.offHandSpeed > 0 ? ` / ${s.offHandSpeed.toFixed(2)}` : ''}`],
        ]} />
        <StatSection title='Modifiers' rows={[
            ['Hit Chance', percent(s.hitChance)],
            ['Critical Strike', percent(s.meleeCrit)],
            ['Haste', percent(s.meleeHaste)],
            ['Expertise', percent(s.expertise)],
            ['Ranged Critical Strike', usesRangedWeapon ? percent(s.rangedCrit) : undefined],
            ['Ranged Haste', usesRangedWeapon ? percent(s.rangedHaste) : undefined],
            ['Spell Power', castsSpells ? formatWithCommas(s.spellPower) : undefined],
            ['Spell Critical Strike', castsSpells ? percent(s.spellCrit) : undefined],
            ['Spell Haste', castsSpells ? percent(s.spellHaste) : undefined],
            ['Spell Penetration', castsSpells ? formatWithCommas(s.spellPenetration) : undefined],
            ['Mana Regen', castsSpells ? formatWithCommas(s.manaRegen) : undefined],
            ['Combat Regen', castsSpells ? formatWithCommas(s.manaRegenCombat) : undefined],
        ]} />
        <StatSection title='Defense' rows={[
            ['Armor', formatWithCommas(s.armor)], ['Dodge', percent(s.dodge)],
            ['Parry', percent(s.parry)], ['Block', percent(s.block)],
        ]} />
    </div>;
}
