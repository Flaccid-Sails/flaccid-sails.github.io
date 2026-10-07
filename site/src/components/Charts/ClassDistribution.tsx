import { PlayerDTO } from '@src/models/PlayerDTO';
import { useMemo, useState } from 'react';
import { Button } from '../Button/Button';
import { ChartBar } from './ChartBar';

const classes = ['Warrior', 'Mage', 'Rogue', 'Priest', 'Hunter', 'Warlock', 'Druid', 'Paladin', 'Shaman'];
const filters = ['ALL', 'MAX LEVEL', 'RAID READY'] as const;
type Filter = typeof filters[number];

interface Props {
    players: PlayerDTO[];
    maxLevel?: number;
    minimumRaidItemLevel?: number;
}

export function ClassDistribution({ players, maxLevel, minimumRaidItemLevel }: Props) {
    const [filter, setFilter] = useState<Filter>('ALL');
    const filteredPlayers = useMemo(() => players.filter(player => {
        if (filter === 'MAX LEVEL') return player.level === maxLevel;
        if (filter === 'RAID READY') return player.itemLevel >= (minimumRaidItemLevel ?? 0);
        return true;
    }), [players, filter, maxLevel, minimumRaidItemLevel]);

    const distribution = useMemo(() => {
        const counts = new Map<string, number>();
        for (const player of filteredPlayers) counts.set(player.class, (counts.get(player.class) ?? 0) + 1);
        return classes.map(name => ({ name, count: counts.get(name) ?? 0 }))
            .sort((a, b) => b.count - a.count || classes.indexOf(a.name) - classes.indexOf(b.name));
    }, [filteredPlayers]);
    const highestCount = Math.max(1, ...distribution.map(entry => entry.count));

    return <section className='wow-chart-panel class-distribution' aria-label='Class distribution'>
        <div className='wow-chart-heading'>
            <h2>Class distribution</h2>
            <span>{filteredPlayers.length} players</span>
        </div>
        <div className='wow-chart-rows'>
            {distribution.map(entry => <ChartBar key={entry.name}
                characterClass={entry.name} label={entry.name} value={entry.count}
                max={highestCount} displayValue={String(entry.count)}
                valueLabel='players relative to the largest class' />)}
        </div>
        <div className='class-distribution-filters' aria-label='Filter class distribution'>
            {filters.map(option => <Button key={option} className='class-distribution-filter'
                selected={option === filter} onClick={() => setFilter(option)}>{option}</Button>)}
        </div>
    </section>;
}
