import { PlayerDTO } from '@src/models/PlayerDTO';
import { calculateTimeDifference, colorParse, sortComparers, toRoman, transformParse } from '@src/utils/helpers';
import { Images } from '@src/utils/images';
import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { PlayerSection } from './PlayerSection';
import { EventEmitter } from '@src/utils/event-emitter';
import { HoverElement } from '../Popups/HoverElement';
import { ZoneDTO } from '@src/models/ZoneDTO';

export interface Section {
    title: string;
    style: CSSProperties;
    className?: string;
    content: ReactNode;
    hideIntermediate?: boolean;
}

interface Props {
    player: PlayerDTO;
    maxLevel?: number;
    sortedCriteria?: keyof typeof sortComparers;
    zones?: ZoneDTO[];
}

export function Player({ player, maxLevel, sortedCriteria, zones }: Props): ReactNode {
    const [width, setWidth] = useState<number>(0);

    const sectionsRef = useRef<HTMLDivElement>(null);
    const resizeTimeout = useRef<NodeJS.Timeout>(undefined);

    const lastLogin = calculateTimeDifference(player.lastLogin, true);
    const classSlug = player.class.toLowerCase().replaceAll(' ', '-');
    const realmSlug = player.realm.toLowerCase().replaceAll(' ', '-');
    const href = player.realm === 'Preview' ? undefined : `https://classic.warcraftlogs.com/character/eu/${realmSlug}/${player.name.toLowerCase()}`;

    const title = useMemo(() => player.rank === 0 ? 'Guild master' : player.rank <= 2 ? 'Captain' : player.class, [player]);

    useEffect(() => {
        function resize(): void {
            if (resizeTimeout.current) {
                clearTimeout(resizeTimeout.current);
                resizeTimeout.current = undefined;
            }

            resizeTimeout.current = setTimeout(() => {
                resizeTimeout.current = undefined;
                if (sectionsRef.current) {
                    setWidth(sectionsRef.current.clientWidth);
                }
            }, 100);
        }

        if (sectionsRef.current) {
            setWidth(sectionsRef.current.clientWidth);
            const observer = new ResizeObserver(resize);
            observer.observe(sectionsRef.current);
            return () => observer.disconnect();
        }

        return () => { };
    }, []);

    const openPlayerCharacter = (): void => {
        if (player.level !== maxLevel) {
            alert('Only available for max level players');
            return;
        }

        EventEmitter.emit('OPEN_CHARACTER_DIALOG', player);
    };

    const openPlayerTalents = (): void => {
        EventEmitter.emit('OPEN_SPECIALIZATIONS_DIALOG', player);
    };

    const tooltip = (type: 'DPS' | 'HEAL' | 'TANK'): React.ReactNode => (
        <div className='player-log-tooltip'>
            <div className='player-log-list'>
                {zones?.flatMap(f => f.bosses).map(boss => {
                    const playerBoss = player.bosses?.find(b => b.bossId === boss.id);
                    const log = type === 'DPS' ? playerBoss?.dps
                        : type === 'HEAL'
                            ? playerBoss?.healer
                            : playerBoss?.tank;

                    return playerBoss && log !== undefined && (
                        <div key={boss.id} className='player-log-row'>
                            <img className='player-log-icon'
                                src={boss.id < 0 ? Images.wowIcon : `https://assets.rpglogs.com/img/warcraft/bosses/${boss.id}-icon.jpg`}
                                alt='Boss' />
                            <p className='player-log-name'>{boss.name}</p>
                            <p className={`${colorParse(log ?? 0)} player-log-score`}>
                                {log && log !== -1 ? log.toFixed(0) : '-'}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const anyLogs = (player.dps && player.dps !== -1)
        || (player.healer && player.healer !== -1)
        || (player.tank && player.tank !== -1);

    const sections: (boolean | number | null | undefined | Section)[] = [
        {
            title: 'RANK',
            style: { color: `var(--rank-${player.rank}-color)`, width: 40 },
            className: 'player-rank',
            content: toRoman(player.rank),
        },
        player.level !== maxLevel && {
            title: 'LEVEL',
            style: { width: 45 },
            content: player.level,
        },
        player.itemLevel !== -1 && {
            title: 'ITEM LEVEL',
            style: { width: 60 },
            content: player.itemLevel,
        },
        player.itemLevel !== -1 && lastLogin !== 'Today' && (sortedCriteria === 'LOGGED IN' || !anyLogs) && {
            title: 'LAST LOGIN',
            style: { width: 100 },
            content: lastLogin,
        },
        player.level === maxLevel && player.dps && player.dps !== -1 && {
            title: 'DPS',
            style: { width: 70 },
            content: (
                <HoverElement className={colorParse(player.dps)}
                    side='LEFT'
                    content={() => tooltip('DPS')}
                >
                    {transformParse(player.dps)}
                </HoverElement>
            ),
        },
        player.level === maxLevel && player.healer && player.healer !== -1 && {
            title: 'HEAL',
            style: { width: 70 },
            content: (
                <HoverElement className={colorParse(player.healer)}
                    side='LEFT'
                    content={() => tooltip('HEAL')}
                >
                    {transformParse(player.healer)}
                </HoverElement>
            ),
        },
        player.level === maxLevel && player.tank && player.tank !== -1 && {
            title: 'TANK DPS',
            style: { width: 70 },
            content: (
                <HoverElement className={colorParse(player.tank)}
                    side='LEFT'
                    content={() => tooltip('TANK')}
                >
                    {transformParse(player.tank)}
                </HoverElement>
            ),
        },
        player.level === maxLevel && player.difficulty && player.difficulty !== -1 && Math.max(player.dps ?? -1, player.healer ?? -1, player.tank ?? -1) !== -1 && {
            title: 'PROGRESS',
            style: { width: 80 },
            content: `${player.killedBosses ?? 0} Bosses`,
        }
    ];

    return (
        <div className='player-card'>
            <div className='player-card-layout'>
                <div className='player-card-artwork'>
                    <button className='player-equipment-button'
                        style={{ backgroundImage: `url(${Images.gearIcon})`, backgroundSize: 23, left: width + 120 }}
                        title='Check equipment'
                        onClick={openPlayerCharacter} aria-label={`View ${player.name}'s gear`} disabled={player.level !== maxLevel} />

                    <button className='player-talents-button'
                        style={{ backgroundImage: `url(${Images.talentsIcon})`, backgroundSize: 20, left: width + 144 }}
                        title='Check talents'
                        onClick={openPlayerTalents} aria-label={`View ${player.class} talents`} />

                    <div className='player-frame-left'
                        style={{ backgroundImage: `url(${Images.frame})`, backgroundSize: 210 }} />
                    <div className='player-frame-top'
                        style={{ backgroundImage: `url(${Images.frameLines})`, backgroundSize: 210, width: width }} />
                    <div className='player-frame-right-outer'
                        style={{ backgroundImage: `url(${Images.frame})`, backgroundSize: 210, backgroundPositionX: 100, left: width + 96 }} />
                    <div className='player-frame-right-middle'
                        style={{ backgroundImage: `url(${Images.frame})`, backgroundSize: 210, backgroundPositionX: 96, left: width + 123 }} />
                    <div className='player-frame-right-inner'
                        style={{ backgroundImage: `url(${Images.frame})`, backgroundSize: 210, backgroundPositionX: 68, left: width + 148 }} />

                    <div className='player-frame-bottom'
                        style={{ backgroundImage: `url(${Images.frameLines})`, backgroundSize: 210, backgroundPositionY: 22, width: width + 110 }} />
                    <div className='player-frame-lower-right'
                        style={{ backgroundImage: `url(${Images.frame})`, backgroundSize: 210, backgroundPositionX: 49, left: width + 147 }} />
                    <div className='player-frame-lower-left'
                        style={{ backgroundImage: `url(${Images.frame})`, backgroundSize: 210, backgroundPositionX: 29, left: 20 }} />

                    {player.rank <= 5 && (
                        <div className='player-rank-border'
                            style={{ backgroundImage: `url(${Images.specialRankBorder})`, backgroundSize: 110 }} />
                    )}

                    {player.rank >= 6 && player.rank <= 7 && (
                        <div className='player-rank-border-muted'
                            style={{ backgroundImage: `url(${Images.specialRankBorder})`, backgroundSize: 110 }} />
                    )}

                    {player.rank <= 4 && (
                        <div className='player-rank-glow'
                            style={{
                                top: 16.4,
                                left: 72,
                                background: 'radial-gradient(circle at 35% 35%, #ffe6f7, #ff66cc 55%, #b3006b)',
                                boxShadow: '0 0 6px 2px rgba(255, 102, 204, 0.8)',
                            }} />
                    )}
                </div>

                <a className='player-avatar-link'
                    title='Open WC logs for user'
                    href={href}
                    target='_blank'
                    rel="noreferrer"
                >
                    <img className='player-avatar' src={player.image || Images.wowIcon} alt='test' />
                </a>
                <p style={{ color: `var(--${classSlug}-color)` }}
                    className='player-identity'
                    title={title}
                >
                    {player.name}
                    {' '}
                    <span className='player-realm'>
                        {player.realm}
                    </span>
                </p>
                <div className='player-metrics'>
                    <div ref={sectionsRef} className='player-sections'>
                        {sections.filter(Boolean).map((f, i) => (
                            <PlayerSection key={(f as Section).title}
                                section={f as Section}
                                prevSection={sections[i - 1] as Section}
                                isFirst={i === 0} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
