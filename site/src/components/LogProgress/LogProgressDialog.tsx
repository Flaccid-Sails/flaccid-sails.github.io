import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PlayerDTO } from '@src/models/PlayerDTO';
import type { PlayerLogEntry, LogRole } from '@src/models/PlayerLogEntry';
import type { ZoneDTO } from '@src/models/ZoneDTO';
import { readData } from '@src/utils/data';
import { colorParse, transformParse } from '@src/utils/helpers';
import { logRoles, searchLogHistory, selectLogSeries, summarizeLogSeries } from '@src/utils/log-progress';
import { Images } from '@src/utils/images';
import { CloseButton } from '../Button/CloseButton';
import { Button } from '../Button/Button';
import { classPortrait, WindowFrame } from '../Frame/WindowFrame';
import { useDialogFade } from '../Frame/useDialogFade';
import { ScrollView } from '../ScrollView/ScrollView';
import { ChartBar } from '../Charts/ChartBar';
import '../Frame/legacy.scss';
import './log-progress.scss';

const date = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
}).format(timestamp);
const shortDate = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short',
}).format(timestamp);
const changeLabel = (change: number) => `${change > 0 ? '+' : ''}${change.toFixed(1)} pp`;
const bossKey = (entry: { zoneId: number; bossId: number }) => JSON.stringify([entry.zoneId, entry.bossId]);

function ProgressChart({ series, selected, onSelect }: {
    series: PlayerLogEntry[]; selected: number; onSelect: (index: number) => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(760);
    useEffect(() => {
        const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
        observer.observe(container.current!);
        return () => observer.disconnect();
    }, []);
    const left = 32, right = width - 16, top = 20, bottom = 172;
    const first = series[0], latest = series[series.length - 1];
    const duration = latest.endTime - first.endTime;
    const points = series.map(entry => ({
        x: duration ? left + (entry.endTime - first.endTime) / duration * (right - left) : (left + right) / 2,
        y: bottom - entry.log / 100 * (bottom - top),
    }));
    const entry = series[selected];

    return <section className='legacy-tree-panel log-progress-chart'>
        <header className='wow-chart-heading'><h2>Parse history</h2><span>Percentile · 0–100</span></header>
        <div className='log-progress-plot' ref={container}>
        <svg viewBox={`0 0 ${width} 202`} role='group' aria-label='Parse percentile over time. Select a point to inspect a report.'>
            {[0, 25, 50, 75, 100].map(tick => {
                const y = bottom - tick / 100 * (bottom - top);
                return <g key={tick}>
                    <line x1={left} x2={right} y1={y} y2={y} className='log-progress-grid' />
                    <text x={left - 9} y={y + 4} textAnchor='end' className='log-progress-axis'>{tick}</text>
                </g>;
            })}
            {series.length > 1 && <>
                <polygon points={`${left},${bottom} ${points.map(point => `${point.x},${point.y}`).join(' ')} ${right},${bottom}`}
                    fill='#d8b66e12' />
                <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} className='log-progress-line' />
            </>}
            {points.map((point, index) => <circle key={series[index].reportCode}
                cx={point.x} cy={point.y} r={index === selected ? 6 : 4.5}
                className={`log-progress-point ${colorParse(series[index].log)}${index === selected ? ' selected' : ''}`}
                tabIndex={0} role='button' aria-pressed={index === selected}
                aria-label={`${date(series[index].endTime)}: ${transformParse(series[index].log)}, ${series[index].reportTitle}`}
                onFocus={() => onSelect(index)} onMouseEnter={() => onSelect(index)}
                onClick={() => onSelect(index)} onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') { onSelect(index); event.preventDefault(); }
                }}>
                <title>{`${date(series[index].endTime)} · ${transformParse(series[index].log)} · ${series[index].reportTitle}`}</title>
            </circle>)}
            <text x={left} y='196' className='log-progress-axis'>{shortDate(first.endTime)}</text>
            {duration > 0 && <text x={right} y='196' textAnchor='end' className='log-progress-axis'>{shortDate(latest.endTime)}</text>}
        </svg>
        </div>
        <div className='log-progress-inspection' aria-live='polite'>
            <div><span className='log-progress-report-title'>{entry.reportTitle}</span>
                <time dateTime={new Date(entry.endTime).toISOString()}>{date(entry.endTime)}</time></div>
            <strong className={colorParse(entry.log)}>{transformParse(entry.log)}</strong>
        </div>
    </section>;
}

function ProgressSeries({ series, player, query, matchingReportCodes }: {
    series: PlayerLogEntry[]; player: PlayerDTO; query: string; matchingReportCodes: Set<string>;
}) {
    const [selected, setSelected] = useState(series.length - 1);
    const reports = series.map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => matchingReportCodes.has(entry.reportCode));
    useEffect(() => {
        if (!query.trim() || matchingReportCodes.size === series.length) return;
        const match = series.findIndex(entry => matchingReportCodes.has(entry.reportCode));
        if (match !== -1) setSelected(match);
    }, [query, series, matchingReportCodes]);
    const summary = summarizeLogSeries(series);
    if (!summary) return <p role='status' className='log-progress-status'>No parses available for this selection.</p>;

    return <>
        <dl className='log-progress-summary' aria-label='Parse summary'>
            {[
                { label: 'First', entry: summary.first, latest: false },
                { label: 'Latest', entry: summary.latest, latest: true },
                { label: 'Best', entry: summary.best, latest: false },
            ].map(({ label, entry, latest }) => <div key={label}
                className={`log-progress-summary-stat${latest ? ' log-progress-summary-latest' : ''}`}>
                <dt>{label}</dt><dd className={colorParse(entry.log)}>{transformParse(entry.log)}</dd>
                <time dateTime={new Date(entry.endTime).toISOString()} title={date(entry.endTime)}>{shortDate(entry.endTime)}</time>
            </div>)}
            <div className='log-progress-summary-stat log-progress-change'>
                <dt>Change since first</dt>
                <dd className={series.length < 2 ? '' : summary.change > 0 ? 'log-progress-gain' : summary.change < 0 ? 'log-progress-loss' : ''}>
                    {series.length > 1 ? <>{summary.change > 0 ? '+' : ''}{summary.change.toFixed(1)}<small>pp</small></> : '—'}
                </dd>
                <span>{series.length} {series.length === 1 ? 'report' : 'reports'}</span>
            </div>
        </dl>
        <ProgressChart series={series} selected={selected} onSelect={setSelected} />
        <section className='wow-chart-panel log-progress-reports' aria-label='Report history'>
            <header className='wow-chart-heading'><h2>Raid nights</h2>
                <span>{query.trim() ? `${reports.length} of ${series.length} reports` : `${series.length} reports · oldest first`}</span>
            </header>
            <div className='wow-chart-rows'>
                {reports.map(({ entry, index }) => {
                    const change = index ? entry.log - series[index - 1].log : undefined;
                    return <button key={entry.reportCode} type='button'
                        className={`legacy-challenge-card log-progress-report${selected === index ? ' selected' : ''}`}
                        aria-pressed={selected === index} onClick={() => setSelected(index)}
                        aria-label={`Inspect ${entry.reportTitle}, ${date(entry.endTime)}, parse ${transformParse(entry.log)}`}>
                        <span className='log-progress-report-meta'>
                            <time dateTime={new Date(entry.endTime).toISOString()}>{date(entry.endTime)}</time>
                            <span className={change === undefined ? '' : change > 0 ? 'log-progress-gain' : change < 0 ? 'log-progress-loss' : ''}>
                                {change === undefined ? 'First recorded parse' : changeLabel(change)}
                            </span>
                        </span>
                        <ChartBar characterClass={player.class} label={entry.reportTitle} value={entry.log} max={100}
                            displayValue={transformParse(entry.log)} valueLabel='parse percentile' />
                    </button>;
                })}
                {!reports.length && <p role='status' className='wow-chart-empty'>No raid nights match this search for the selected role and difficulty.</p>}
            </div>
        </section>
        <p className='log-progress-explanation'>Best parse per report, for the same role and difficulty. Changes in percentile points (pp).</p>
        {series.length === 1 && <p role='status' className='log-progress-explanation'>A second report is needed to show improvement over time.</p>}
    </>;
}

function ProgressHistory({ history, zones, player, query, onBossChanged }: {
    history: PlayerLogEntry[]; zones: ZoneDTO[]; player: PlayerDTO; query: string; onBossChanged: () => void;
}) {
    const [selectedBoss, setSelectedBoss] = useState<string>();
    const [selectedRole, setSelectedRole] = useState<LogRole>();
    const [selectedDifficulty, setSelectedDifficulty] = useState<number>();
    const allBosses = useMemo(() => {
        const unique = new Map<string, { key: string; zoneId: number; bossId: number; name: string; zoneName: string }>();
        for (const entry of history) {
            const zone = zones.find(zone => zone.id === entry.zoneId);
            const boss = zone?.bosses.find(boss => boss.id === entry.bossId);
            const key = bossKey(entry);
            if (!unique.has(key)) unique.set(key, {
                key, zoneId: entry.zoneId, bossId: entry.bossId,
                name: boss?.name ?? `Boss ${entry.bossId}`, zoneName: zone?.name ?? `Raid ${entry.zoneId}`,
            });
        }
        return [...unique.values()];
    }, [history, zones]);
    const matchingHistory = useMemo(() => searchLogHistory(history, zones, query), [history, zones, query]);
    const matchingBosses = new Set(matchingHistory.map(bossKey));
    const bosses = allBosses.filter(boss => matchingBosses.has(boss.key));
    const boss = bosses.find(boss => boss.key === selectedBoss) ?? bosses[0];
    useLayoutEffect(() => { onBossChanged(); }, [boss?.key, onBossChanged]);
    const bossEntries = history.filter(entry => bossKey(entry) === boss?.key);
    const roles = logRoles.filter(role => bossEntries.some(entry => entry.role === role.value));
    const role = roles.find(role => role.value === selectedRole)?.value ?? roles[0]?.value;
    const difficulties = [...new Set(bossEntries.filter(entry => entry.role === role).map(entry => entry.difficulty))].sort((a, b) => b - a);
    const difficulty = difficulties.includes(selectedDifficulty!) ? selectedDifficulty! : difficulties[0];
    const series = boss && role ? selectLogSeries(history, { ...boss, role, difficulty }) : [];
    const matchingReportCodes = new Set(boss && role
        ? selectLogSeries(matchingHistory, { ...boss, role, difficulty }).map(entry => entry.reportCode) : []);

    if (!history.length) return <p role='status' className='log-progress-status'>No recorded boss parses for this player yet.</p>;
    if (!bosses.length) return <p role='status' className='log-progress-status'>No bosses or raid nights match “{query.trim()}”.</p>;

    return <div className='log-progress-layout'>
        <nav className='log-progress-bosses' aria-label='Choose a boss'>
            <div className='log-progress-boss-heading'>Bosses</div>
            {[...new Set(bosses.map(boss => boss.zoneId))].map(zoneId => <div key={zoneId} className='log-progress-zone'>
                <h2>{bosses.find(boss => boss.zoneId === zoneId)?.zoneName}</h2>
                <div className='log-progress-boss-list'>
                    {bosses.filter(boss => boss.zoneId === zoneId).map(choice => <button type='button'
                        key={choice.key} className='legacy-category-button log-progress-boss-choice' aria-pressed={choice.key === boss?.key}
                        onClick={() => setSelectedBoss(choice.key)} title={choice.name}>
                        <img src={choice.bossId < 0 ? Images.wowIcon : `https://assets.rpglogs.com/img/warcraft/bosses/${choice.bossId}-icon.jpg`} alt='' />
                        <span>{choice.name.replace(/ \(demo\)$/, '')}</span>
                    </button>)}
                </div>
            </div>)}
        </nav>
        <div className='log-progress-main'>
            <header className='log-progress-encounter'>
                <h2>{boss?.name.replace(/ \(demo\)$/, '')}</h2>
                <span>{boss?.zoneName}</span>
            </header>
            <div className='log-progress-filters'>
                <div className='log-progress-roles' role='group' aria-label='Log role'>
                    {roles.map(choice => <Button key={choice.value} selected={role === choice.value}
                        onClick={() => setSelectedRole(choice.value)}>{choice.label}</Button>)}
                </div>
                <div className='log-progress-difficulties' role='group' aria-label='Difficulty'>
                    {difficulties.length === 1 ? <span>Difficulty {difficulty}</span> : difficulties.map(value =>
                        <Button key={value} selected={value === difficulty}
                            onClick={() => setSelectedDifficulty(value)}>Difficulty {value}</Button>)}
                </div>
            </div>
            <ProgressSeries key={`${boss?.key}/${role}/${difficulty}`} series={series} player={player}
                query={query} matchingReportCodes={matchingReportCodes} />
        </div>
    </div>;
}

export function LogProgressDialog({ player, zones, isDemo, onClose }: {
    player: PlayerDTO; zones: ZoneDTO[]; isDemo: boolean; onClose: () => void;
}) {
    const [history, setHistory] = useState<PlayerLogEntry[]>();
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [query, setQuery] = useState('');
    const frame = useRef<HTMLDivElement>(null);
    const scroll = useRef<HTMLDivElement>(null);
    const scrollToSummary = useCallback(() => { scroll.current?.scrollTo({ top: 0 }); }, []);
    const { isClosing, fadeOut } = useDialogFade();
    const close = useCallback(() => fadeOut(onClose), [fadeOut, onClose]);

    useEffect(() => {
        let active = true;
        setHistory(undefined);
        setFailed(false);
        void readData<PlayerLogEntry[]>(`/logHistory/${player.realm}/${player.name}`)
            .then(history => {
                if (!Array.isArray(history)) throw new Error('Missing log history');
                if (active) setHistory(history);
            }).catch(() => { if (active) setFailed(true); });
        return () => { active = false; };
    }, [player.realm, player.name, attempt]);

    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        frame.current?.querySelector<HTMLButtonElement>('.wow-window-close')?.focus({ preventScroll: true });
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { close(); event.preventDefault(); }
            if (event.key !== 'Tab') return;
            const controls = Array.from(frame.current!.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), [tabindex="0"]')).filter(control => !control.closest('[aria-hidden="true"]'));
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
            else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previousFocus?.focus({ preventScroll: true });
        };
    }, [close]);

    return <div className={`log-progress-overlay dialog-fade${isClosing ? ' dialog-fade-out' : ''}`} aria-hidden={isClosing}>
        <div className='log-progress-backdrop' onClick={close} />
        <div ref={frame} className='log-progress-window' role='dialog' aria-modal='true' aria-labelledby='log-progress-heading'>
            <WindowFrame portrait={classPortrait(player.class)} />
            <h1 id='log-progress-heading' className='wow-window-title'>Log progress</h1>
            <CloseButton className='wow-window-close' onClick={close} aria-label='Close log progress' />
            <div className='log-progress-content legacy-challenges-surface' aria-busy={!history && !failed}>
                <div className='log-progress-player legacy-challenges-toolbar'>
                    <strong title={isDemo ? 'Sample raid history' : player.realm}
                        style={{ color: `var(--${player.class.toLowerCase().replaceAll(' ', '-')}-color)` }}>{player.name}</strong>
                    <label className='log-progress-search'>
                        <input type='search' aria-label='Search bosses and raid nights' placeholder='Search bosses or raid nights'
                            value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
                                if (event.key === 'Escape' && query) {
                                    event.preventDefault(); event.stopPropagation(); setQuery('');
                                }
                            }} />
                    </label>
                </div>
                <ScrollView ref={scroll} className='log-progress-scroll'>
                    {!history && <div className='log-progress-status' role='status'>
                        <p>{failed ? 'Log history is unavailable. Please try again.' : 'Loading log history…'}</p>
                        {failed && <Button onClick={() => setAttempt(attempt + 1)}>Retry</Button>}
                    </div>}
                    {history && <ProgressHistory key={`${player.realm}/${player.name}`} history={history} zones={zones} player={player} query={query}
                        onBossChanged={scrollToSummary} />}
                </ScrollView>
            </div>
        </div>
    </div>;
}
