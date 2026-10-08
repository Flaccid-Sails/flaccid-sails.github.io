import { PlayerDTO } from '@src/models/PlayerDTO';
import { ZoneDTO } from '@src/models/ZoneDTO';
import { calculateTimeDifference, colorParse, sortComparers, toRoman, transformParse } from '@src/utils/helpers';
import { Images } from '@src/utils/images';
import { ReactNode } from 'react';
import { EventEmitter } from '@src/utils/event-emitter';
import { HoverElement } from '../Popups/HoverElement';

interface Props {
    player: PlayerDTO;
    maxLevel?: number;
    sortedCriteria?: keyof typeof sortComparers;
    zones?: ZoneDTO[];
}

export function Player({ player, maxLevel, sortedCriteria, zones }: Props): ReactNode {
    const lastLogin = calculateTimeDifference(player.lastLogin, true);
    const classSlug = player.class.toLowerCase().replaceAll(' ', '-');
    const realmSlug = player.realm.toLowerCase().replaceAll(' ', '-');
    const href = player.realm === 'Preview' ? undefined : `https://classic.warcraftlogs.com/character/eu/${realmSlug}/${player.name.toLowerCase()}`;
    const rankTitle = player.rank === 0 ? 'Guild master' : player.rank <= 2 ? 'Captain' : player.class;
    const scores = [
        { type: 'DPS' as const, label: 'DPS', value: player.dps },
        { type: 'HEAL' as const, label: 'Heal', value: player.healer },
        { type: 'TANK' as const, label: 'Tank DPS', value: player.tank },
    ].filter(score => player.level === maxLevel && score.value !== undefined && score.value !== -1 && score.value !== 0);
    const showLastLogin = player.itemLevel !== -1 && lastLogin !== 'Today' && (sortedCriteria === 'LOGGED IN' || !scores.length);
    const showProgress = player.level === maxLevel && player.difficulty !== undefined && player.difficulty !== -1 && scores.length > 0;
    const canViewEquipment = player.level === maxLevel;
    const canViewTalents = player.level === 60;

    const openPlayerCharacter = (): void => {
        if (!canViewEquipment) return;
        EventEmitter.emit('OPEN_CHARACTER_DIALOG', player);
    };

    const openPlayerTalents = (): void => {
        if (!canViewTalents) return;
        EventEmitter.emit('OPEN_SPECIALIZATIONS_DIALOG', player);
    };

    const tooltip = (type: 'DPS' | 'HEAL' | 'TANK'): ReactNode => (
        <div className='player-log-tooltip'>
            <div className='player-log-list'>
                {zones?.flatMap(zone => zone.bosses).map(boss => {
                    const playerBoss = player.bosses?.find(log => log.bossId === boss.id);
                    const log = type === 'DPS' ? playerBoss?.dps : type === 'HEAL' ? playerBoss?.healer : playerBoss?.tank;
                    return playerBoss && log !== undefined && (
                        <div key={boss.id} className='player-log-row'>
                            <img className='player-log-icon'
                                src={boss.id < 0 ? Images.wowIcon : `https://assets.rpglogs.com/img/warcraft/bosses/${boss.id}-icon.jpg`}
                                alt='' />
                            <p className='player-log-name'>{boss.name}</p>
                            <p className={`${colorParse(log)} player-log-score`}>
                                {log && log !== -1 ? log.toFixed(0) : '-'}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const portrait = <img className='player-avatar' src={player.image || Images.wowIcon} alt={`${player.class} portrait`} />;

    return (
        <article className='player-card'>
            <div className='player-avatar-column'>
                {href ? (
                    <a className='player-avatar-link' href={href} target='_blank' rel='noreferrer'
                        aria-label={`View ${player.name} on Warcraft Logs`}>{portrait}</a>
                ) : <span className='player-avatar-link'>{portrait}</span>}
                <span className='player-avatar-rank' style={{ color: `var(--rank-${player.rank}-color)` }}>
                    Rank {toRoman(player.rank)}
                </span>
            </div>

            <div className='player-identity'>
                <div className='player-name-line'>
                    <strong className='player-name' style={{ color: `var(--${classSlug}-color)` }} title={rankTitle}>{player.name}</strong>
                    <span className='player-realm'>{player.realm}</span>
                </div>
            </div>

            {(canViewEquipment || canViewTalents) && <div className='player-actions'>
                {canViewEquipment && <button type='button' className='player-action player-equipment-button'
                    style={{ backgroundImage: `url(${Images.gearIcon})` }}
                    title='Check equipment' onClick={openPlayerCharacter}
                    aria-label={`View ${player.name}'s gear`} />}
                {canViewTalents && <button type='button' className='player-action player-talents-button'
                    style={{ backgroundImage: `url(${Images.talentsIcon})` }}
                    title='Check talents' onClick={openPlayerTalents}
                    aria-label={`View ${player.name}'s talents`} />}
            </div>}

            <div className='player-metrics'>
                {player.level !== maxLevel && <div className='player-stat'>
                    <span className='player-stat-label'>Level</span>
                    <span className='player-stat-value'>{player.level}</span>
                </div>}
                {player.itemLevel !== -1 && <div className='player-stat'>
                    <span className='player-stat-label'>Item level</span>
                    <span className='player-stat-value'>{player.itemLevel}</span>
                </div>}
                {scores.map(score => <div key={score.type} className='player-stat'>
                    <span className='player-stat-label'>{score.label}</span>
                    <HoverElement className={`player-stat-value player-score ${colorParse(score.value!)}`}
                        side='LEFT' content={() => tooltip(score.type)}>
                        {transformParse(score.value!)}
                    </HoverElement>
                </div>)}
                {showProgress && <div className='player-stat'>
                    <span className='player-stat-label'>Progress</span>
                    <span className='player-stat-value'>{player.killedBosses ?? 0} bosses</span>
                </div>}
                {showLastLogin && <div className='player-stat'>
                    <span className='player-stat-label'>Last login</span>
                    <span className='player-stat-value'>{lastLogin}</span>
                </div>}
            </div>
        </article>
    );
}
