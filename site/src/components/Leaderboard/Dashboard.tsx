import { Images } from '@src/utils/images';
import { PlayerDTO } from '@src/models/PlayerDTO';
import { DashboardBossDTO } from '@src/models/DashboardBossDTO';
import { useMemo } from 'react';
import { ClassDistribution } from '../Charts/ClassDistribution';
import { HighestLog } from '../Charts/HighestLog';
import { DashboardLogDTO } from '@src/models/DashboardLogDTO';

interface BossWithLogs extends DashboardBossDTO {
    players: PlayerDTO[];
}

interface Props {
    players: PlayerDTO[];
    bosses: DashboardBossDTO[];
    maxLevel?: number;
    minimumRaidItemLevel?: number;
    searchText?: string;
}

export function Dashboard({
    players,
    bosses: dashboardBosses,
    maxLevel,
    minimumRaidItemLevel,
    searchText,
}: Props): React.ReactNode {
    const bossesWithHighestDifficultyLogs = useMemo(() => {
        const search = searchText?.trim().toLowerCase();
        const byCharacter = new Map(players.map(player => [`${player.realm}/${player.name}`, player]));
        return dashboardBosses.map((boss): BossWithLogs => {
            const seen = new Set<string>();
            const bossPlayers = [...boss.dps, ...boss.healers, ...boss.tanks]
                .map(log => {
                    const key = `${log.realm}/${log.name}`;
                    if (seen.has(key)) return undefined;
                    seen.add(key);
                    return byCharacter.get(key);
                })
                .filter((player): player is PlayerDTO => player !== undefined &&
                    (!search || player.name.toLowerCase().includes(search) || player.realm.toLowerCase().includes(search)));
            return { ...boss, players: bossPlayers };
        });
    }, [dashboardBosses, players, searchText]);

    const averageItemLevel = useMemo(() => {
        let filteredPlayers = players.filter(f => f.killedBosses);

        if (filteredPlayers.length === 0) {
            filteredPlayers = players.filter(f => f.level === maxLevel && f.itemLevel);
        }

        const totalItemLevel = filteredPlayers
            .reduce((sum, player) => sum + (player.itemLevel || 0), 0);

        return totalItemLevel / filteredPlayers.length;
    }, [players, maxLevel]);

    const topDps = useMemo(() => {
        return players.reduce((max, p) => (p.dps && p.dps > (max?.dps ?? 0) ? p : max), undefined as PlayerDTO | undefined);
    }, [players]);

    const topHealer = useMemo(() => {
        return players.reduce((max, p) => (p.healer && p.healer > (max?.healer ?? 0) ? p : max), undefined as PlayerDTO | undefined);
    }, [players]);

    const findLog = (player: PlayerDTO, logs: DashboardLogDTO[]): number | undefined => {
        const log = logs.find(f => f.name === player.name && f.realm === player.realm);
        return log?.log;
    };

    const statisticsPanelClass = 'dashboard-stat-panel';

    return (
        <div className='dashboard-content'>
            <div className='dashboard-summary'>
                <div className={statisticsPanelClass}>
                    <span className='dashboard-stat-label'>Total Active Characters</span>
                    <span className='dashboard-stat-value'>{players.length}</span>
                </div>
                <div className={statisticsPanelClass}>
                    <span className='dashboard-stat-label'>Average Item Level</span>
                    <span className='dashboard-stat-value'>
                        {averageItemLevel > 0 ? averageItemLevel.toFixed(0) : 'N/A'}
                    </span>
                </div>
                <div className={statisticsPanelClass}>
                    <span className='dashboard-stat-label'>Top DPS</span>
                    <span className='dashboard-stat-value'>
                        {topDps ? (
                            <span style={{ color: `var(--${topDps.class.toLowerCase().replaceAll(' ', '-')}-color)` }}>
                                {topDps.name}
                            </span>
                        ) : 'N/A'}
                    </span>
                </div>
                <div className={statisticsPanelClass}>
                    <span className='dashboard-stat-label'>Top Healer</span>
                    <span className='dashboard-stat-value'>
                        {topHealer ? (
                            <span style={{ color: `var(--${topHealer.class.toLowerCase().replaceAll(' ', '-')}-color)` }}>
                                {topHealer.name}
                            </span>
                        ) : 'N/A'}
                    </span>
                </div>
            </div>
            <div className='dashboard-charts'>
                <ClassDistribution players={players}
                    maxLevel={maxLevel}
                    minimumRaidItemLevel={minimumRaidItemLevel} />
                <HighestLog players={players}
                    label='Top DPS parses'
                    selector={a => a.dps!}
                    max={100}
                    valueLabel='DPS parse'
                    showOnlyIfFull
                    filterKilledBosses />
                <HighestLog players={players}
                    label='Top healing parses'
                    selector={a => a.healer!}
                    max={100}
                    valueLabel='Healing parse'
                    showOnlyIfFull
                    filterKilledBosses />
            </div>
            <h1 className='dashboard-heading'>Logs Per boss</h1>
            {bossesWithHighestDifficultyLogs.map(boss => (
                <div key={boss.id} className='dashboard-boss-row'>
                    <div className='dashboard-boss-title'>
                        <img className='dashboard-boss-icon'
                            src={boss.id < 0 ? Images.wowIcon : `https://assets.rpglogs.com/img/warcraft/bosses/${boss.id}-icon.jpg`}
                            alt='Boss' />
                        <h2 className='dashboard-boss-name'>{boss.name}</h2>
                    </div>
                    <HighestLog players={boss.players}
                        label='Top DPS parses'
                        selector={a => findLog(a, boss.dps) || 0}
                        max={100}
                        valueLabel='DPS parse' />
                    <HighestLog players={boss.players}
                        label='Top healing parses'
                        selector={a => findLog(a, boss.healers) || 0}
                        max={100}
                        valueLabel='Healing parse' />
                </div>
            ))}
        </div>
    );
}
