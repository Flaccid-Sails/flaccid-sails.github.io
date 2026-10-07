import { PlayerDTO } from '@src/models/PlayerDTO';
import { useMemo } from 'react';
import { ChartBar } from './ChartBar';

interface Props {
    players: PlayerDTO[];
    label?: string;
    max?: number;
    valueLabel: string;
    showOnlyIfFull?: boolean;
    filterKilledBosses?: boolean;
    selector: (player: PlayerDTO) => number;
}

export function HighestLog({ players, label, max = 100, valueLabel, showOnlyIfFull,
    filterKilledBosses, selector }: Props) {
    const highestLogs = useMemo(() => {
        const maxDifficulty = Math.max(0, ...players.map(player => player.difficulty ?? 0));
        const maxKilledBosses = Math.max(0, ...players.map(player => player.killedBosses ?? 0));
        let eligible = players.filter(player => selector(player) > 0);
        const highestDifficulty = eligible.filter(player => player.difficulty === maxDifficulty &&
            (!filterKilledBosses || player.killedBosses === maxKilledBosses));
        if (highestDifficulty.length >= 5) eligible = highestDifficulty;
        return eligible.sort((a, b) => selector(b) - selector(a)).slice(0, 5);
    }, [players, filterKilledBosses, selector]);

    if (showOnlyIfFull && highestLogs.length < 5) return null;

    return <section className='wow-chart-panel highest-log' aria-label={label ?? valueLabel}>
        {label && <div className='wow-chart-heading'><h2>{label}</h2></div>}
        <div className='wow-chart-rows'>
            {highestLogs.length === 0
                ? <p className='wow-chart-empty'>No logs yet</p>
                : highestLogs.map(player => {
                    const value = selector(player);
                    return <ChartBar key={`${player.realm}/${player.name}`}
                        characterClass={player.class} label={player.name} value={value} max={max}
                        displayValue={`${Number.isInteger(value) ? value : value.toFixed(1)}%`}
                        valueLabel={valueLabel} />;
                })}
        </div>
    </section>;
}
