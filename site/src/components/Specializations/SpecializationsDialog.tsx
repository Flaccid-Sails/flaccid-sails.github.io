import { CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Talent, TalentBuild, TalentCatalog, TalentTree } from '@src/models/Talents';
import { PlayerApiDTO } from '@src/models/PlayerApiDTO';
import { EventEmitter } from '@src/utils/event-emitter';
import { loadTalentCatalog, readData } from '@src/utils/data';
import { CloseButton } from '../Button/CloseButton';
import { HoverElement } from '../Popups/HoverElement';
import { classPortrait, WindowFrame } from '../Frame/WindowFrame';
import { useDialogFade } from '../Frame/useDialogFade';
import './specializations.scss';

interface Props { players?: PlayerApiDTO[] }
const asset = (path: string) => `${import.meta.env.BASE_URL}assets/talent-window/${path}`;
const iconUrl = (name: string) => `${import.meta.env.BASE_URL}icons/${name}.jpg`;
const rankKey = (tree: TalentTree, talent: Talent) => `${tree.name}/${talent.name}`;

function TalentDescription({ tree, talent, rank, allRanks = false }: {
    tree: TalentTree; talent: Talent; rank: number; allRanks?: boolean;
}) {
    return <div className='talent-description'>
        <h3>{talent.name}</h3>
        <p className='talent-tooltip-rank'>Rank {rank}/{talent.max}</p>
        {talent.cost && <p>{talent.cost}</p>}
        {rank > 0 && <p className='talent-description-effect'>{talent.descriptions[rank - 1]}</p>}
        {rank < talent.max && <>
            <p className='talent-next-rank'>{rank > 0 ? 'Next rank:' : 'First rank:'}</p>
            <p className='talent-description-effect'>{talent.descriptions[rank]}</p>
        </>}
        {talent.prerequisite && <p className='talent-requirement'>Requires {talent.prerequisite}</p>}
        {talent.row > 1 && <p className='talent-requirement'>Requires {(talent.row - 1) * 5} points in {tree.name}</p>}
        {allRanks && talent.max > 1 && <details className='talent-all-ranks'>
            <summary>All ranks</summary>
            {talent.descriptions.map((description, index) => <p key={index}>
                <span>Rank {index + 1}: </span>{description}
            </p>)}
        </details>}
    </div>;
}

interface TalentBounds { left: number; top: number; right: number; bottom: number; x: number; y: number }

function PrerequisiteArrows({ tree, ranks }: { tree: TalentTree; ranks: Record<string, number> }) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [layout, setLayout] = useState<{ width: number; height: number; nodes: Map<string, TalentBounds> }>();

    useLayoutEffect(() => {
        const grid = svgRef.current?.parentElement;
        if (!grid) return;
        const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>('[data-talent]'));
        const measure = () => {
            const bounds = grid.getBoundingClientRect();
            const nodes = new Map<string, TalentBounds>();
            for (const button of buttons) {
                const rect = button.getBoundingClientRect();
                nodes.set(button.dataset.talent!, {
                    left: rect.left - bounds.left, top: rect.top - bounds.top,
                    right: rect.right - bounds.left, bottom: rect.bottom - bounds.top,
                    x: rect.left - bounds.left + rect.width / 2,
                    y: rect.top - bounds.top + rect.height / 2,
                });
            }
            setLayout({ width: bounds.width, height: bounds.height, nodes });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(grid);
        if (buttons[0]) observer.observe(buttons[0]);
        return () => observer.disconnect();
    }, [tree]);

    return <svg ref={svgRef} className='talent-arrows'
        viewBox={layout ? `0 0 ${layout.width} ${layout.height}` : undefined} aria-hidden='true'>
        {tree.talents.filter(talent => talent.prerequisite).map(talent => {
            const parent = layout?.nodes.get(talent.prerequisite!);
            const target = layout?.nodes.get(talent.name);
            if (!parent || !target) return null;
            const horizontal = Math.abs(parent.y - target.y) < 1;
            const direction = Math.sign(target.x - parent.x);
            const endX = horizontal ? (direction > 0 ? target.left - 1 : target.right + 1) : target.x;
            const endY = horizontal ? target.y : target.top - 1;
            const bendY = (parent.bottom + target.top) / 2;
            const path = horizontal
                ? `M ${direction > 0 ? parent.right : parent.left} ${parent.y} H ${endX - direction * 8}`
                : `M ${parent.x} ${parent.bottom} V ${bendY} H ${target.x} V ${endY - 8}`;
            const active = (ranks[rankKey(tree, talent)] ?? 0) > 0;
            return <g key={talent.name}>
                <path d={path} stroke='#000' strokeWidth='5' fill='none' vectorEffect='non-scaling-stroke' opacity='.7' />
                <path d={path} stroke={active ? '#b2973b' : '#33352f'} strokeWidth='2' fill='none' vectorEffect='non-scaling-stroke' />
                <image href={asset(`arrows/talents-arrow-head-${active ? 'yellow' : 'locked'}.png`)}
                    x={endX - 7} y={endY - 12} width='14' height='12'
                    transform={horizontal ? `rotate(${-direction * 90} ${endX} ${endY})` : undefined} />
            </g>;
        })}
    </svg>;
}

export function SpecializationsDialog({ players }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [catalog, setCatalog] = useState<TalentCatalog>();
    const [catalogFailed, setCatalogFailed] = useState(false);
    const [builds, setBuilds] = useState<TalentBuild[]>();
    const [className, setClassName] = useState('Warrior');
    const [player, setPlayer] = useState<PlayerApiDTO>();
    const [activeBuild, setActiveBuild] = useState(0);
    const [query, setQuery] = useState('');
    const [inspected, setInspected] = useState<{ tree: TalentTree; talent: Talent }>();
    const windowRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef(0);
    const { isClosing, cancelClose, fadeOut } = useDialogFade();
    const close = useCallback(() => {
        requestRef.current++;
        EventEmitter.emit('CLOSE_POPUPS');
        fadeOut(() => setIsOpen(false));
    }, [fadeOut]);

    useEffect(() => {
        const open = (character?: PlayerApiDTO) => {
            const request = ++requestRef.current;
            cancelClose();
            const next = character ?? players?.[0];
            setPlayer(next);
            setCatalog(undefined);
            setCatalogFailed(false);
            setBuilds(undefined);
            setClassName(next?.class ?? 'Warrior');
            setActiveBuild(0);
            setInspected(undefined);
            setQuery('');
            setIsOpen(true);
            void loadTalentCatalog().then(data => {
                if (request === requestRef.current) setCatalog(data);
            }).catch(() => {
                if (request === requestRef.current) setCatalogFailed(true);
            });
            if (next) {
                void readData<TalentBuild[]>(`/talentBuilds/${next.realm}/${next.name}`).then(data => {
                    if (request === requestRef.current) setBuilds(data);
                }).catch(() => { });
            }
        };
        const unsubscribe = EventEmitter.subscribe('OPEN_SPECIALIZATIONS_DIALOG', open);
        const unsubscribeBrowse = EventEmitter.subscribe('OPEN_TALENTS', () => open());
        return () => { requestRef.current++; unsubscribe(); unsubscribeBrowse(); };
    }, [players, cancelClose]);

    useEffect(() => {
        if (!isOpen || isClosing) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const frame = windowRef.current!;
        frame.querySelector<HTMLButtonElement>('.wow-close-button')?.focus({ preventScroll: true });
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                close();
                event.preventDefault();
            }
            if (event.key !== 'Tab') return;
            const controls = Array.from(frame.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href], summary'));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
            else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previousFocus?.focus({ preventScroll: true });
        };
    }, [isOpen, isClosing, close]);

    if (!isOpen) return null;
    const current = catalog?.classes[className];
    const classSlug = className.toLowerCase();
    const build = builds?.[activeBuild];
    const ranks = build?.ranks ?? {};
    const pointTotal = Object.values(ranks).reduce((sum, rank) => sum + rank, 0);
    const pointBudget = Math.max(0, Math.min(player?.level ?? 60, 60) - 9);
    const searched = query.trim().toLowerCase();

    return <div className={`talents-overlay dialog-fade${isClosing ? ' dialog-fade-out' : ''}`} aria-hidden={isClosing}>
        <div className='talents-backdrop' onClick={close} />
        <div ref={windowRef} className='talents-window' role='dialog' aria-modal='true' aria-labelledby='talents-heading'>
            <WindowFrame portrait={classPortrait(className)} />
            <h1 id='talents-heading' className='wow-window-title'>Talents</h1>
            <CloseButton className='wow-window-close' onClick={close} aria-label='Close talents' />
            <div className='talents-content'>
                <div className='talents-toolbar'>
                    <div className='talents-build-tabs' role='tablist' aria-label='Talent builds'>
                        {[0, 1].map(index => <button key={index} type='button' role='tab'
                            aria-selected={activeBuild === index} disabled={index === 1 && !builds?.[1]}
                            className={`talents-build-tab ${activeBuild === index ? 'active' : ''}`}
                            onClick={() => { EventEmitter.emit('CLOSE_POPUPS'); setActiveBuild(index); setInspected(undefined); }}>
                            {index === 0 ? 'Primary' : 'Secondary'}
                            {activeBuild === index
                                ? <img src={asset('tabs/talents-checkmark-c60-2x.png')} alt='' />
                                : !builds?.[index] && <img src={asset('tabs/talents-lock-c60-2x.png')} alt='' />}
                        </button>)}
                    </div>
                    <div className='talents-search'>
                        <input type='search' aria-label='Search talents' placeholder='Search' value={query}
                            onChange={event => setQuery(event.target.value)} />
                    </div>
                </div>
                <div className='talents-area'>
                    <div className='talents-summary'>
                        <p>{player?.name ?? className}{player && ` · Level ${player.level}`}<span>{player?.realm === 'Preview' ? ' · Sample build' : ''}</span></p>
                        <div className='talents-unspent'>Unspent Talents <strong>{builds ? Math.max(0, pointBudget - pointTotal) : '?'}</strong></div>
                    </div>
                    {!catalog && <p className='talents-loading'>{catalogFailed ? 'Talents are unavailable.' : 'Loading talents…'}</p>}
                    {current && <div className='talents-tree-panel'>
                        <div className='talents-tree-scroll' aria-label='Talent trees'>
                            <div className='talents-trees' style={{ backgroundImage: `url(${asset(`backgrounds/talent-background-${classSlug}.png`)})` }}>
                                {current.trees.map((tree, treeIndex) => {
                                    const spent = tree.talents.reduce((sum, talent) => sum + (ranks[rankKey(tree, talent)] ?? 0), 0);
                                    const rows = Math.max(7, ...tree.talents.map(talent => talent.row));
                                    return <section key={tree.name} className='talent-tree' aria-label={`${tree.name} talents`}>
                                        <h2><span className='talent-tree-emblem'>
                                            <img className='talent-tree-icon' src={iconUrl(tree.icon)} alt='' />
                                            <img className='talent-tree-ring' src={asset('headers/talents-main-ring-c60-2x.png')} alt='' />
                                            <span className='talent-tree-points'>{spent}</span>
                                        </span>{tree.name}</h2>
                                        <div className='talent-grid' style={{ '--talent-rows': rows } as CSSProperties}>
                                            <PrerequisiteArrows tree={tree} ranks={ranks} />
                                            {tree.talents.map(talent => {
                                                const rank = Math.min(talent.max, ranks[rankKey(tree, talent)] ?? 0);
                                                const prerequisite = tree.talents.find(candidate => candidate.name === talent.prerequisite);
                                                const available = spent >= (talent.row - 1) * 5 && (!prerequisite || ranks[rankKey(tree, prerequisite)] === prerequisite.max);
                                                const state = rank === talent.max ? 'yellow' : rank > 0 ? 'green' : available ? 'gray' : 'locked';
                                                const matches = !searched || `${talent.name} ${talent.descriptions.join(' ')}`.toLowerCase().includes(searched);
                                                return <HoverElement key={talent.name} className={`talent-cell ${matches ? '' : 'talent-search-dimmed'}`}
                                                    style={{ gridRow: talent.row, gridColumn: talent.col }}
                                                    side={treeIndex === 2 ? 'LEFT' : 'RIGHT'} hoverWithin
                                                    content={() => <div className='talent-tooltip'><TalentDescription tree={tree} talent={talent} rank={rank} /></div>}>
                                                    <button type='button' className={`talent-node talent-node-${state} ${searched && matches ? 'talent-search-match' : ''}`}
                                                        data-talent={talent.name}
                                                        aria-label={`${talent.name}, rank ${rank} of ${talent.max}`}
                                                        aria-expanded={inspected?.talent === talent}
                                                        onClick={() => {
                                                            EventEmitter.emit('CLOSE_POPUPS');
                                                            setInspected(inspected?.talent === talent ? undefined : { tree, talent });
                                                        }}>
                                                        <img className='talent-icon' src={iconUrl(talent.icon)} alt='' />
                                                        <img className='talent-node-frame' src={asset(`talent-frames/talents-node-square-${state}.png`)} alt='' />
                                                        {rank > 0 && <span className='talent-ranks'>{rank}</span>}
                                                    </button>
                                                </HoverElement>;
                                            })}
                                        </div>
                                    </section>;
                                })}
                            </div>
                        </div>
                    </div>}
                    <div className='talents-inner-frame' aria-hidden='true' />
                </div>
                {catalog && <footer className='talents-footer'>
                    <span><a href='https://talentsforever.com/' target='_blank' rel='noreferrer'>Talents Forever · Chris Baldwin</a>
                        {' · '}Art © Blizzard</span>
                </footer>}
            </div>
            {inspected && <aside className='talent-tooltip talent-inspect' aria-label={`${inspected.talent.name} details`}>
                <CloseButton className='talent-inspect-close' aria-label='Close talent details' onClick={() => setInspected(undefined)} />
                <TalentDescription tree={inspected.tree} talent={inspected.talent}
                    rank={Math.min(inspected.talent.max, ranks[rankKey(inspected.tree, inspected.talent)] ?? 0)} allRanks />
            </aside>}
        </div>
    </div>;
}
