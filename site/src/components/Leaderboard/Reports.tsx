import { ReportDTO } from '@src/models/ReportDTO';
import { ReportIndexEntry } from '@src/models/ReportIndexEntry';
import { loadReport } from '@src/utils/data';
import { calculateTimeDifference, colorParse } from '@src/utils/helpers';
import { Virtuoso } from 'react-virtuoso';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Images } from '@src/utils/images';
import { ReportBossDTO } from '@src/models/ReportBossDTO';
import { ReportLogDTO } from '@src/models/ReportLogDTO';
import { PlayerDTO } from '@src/models/PlayerDTO';
import { ZoneDTO } from '@src/models/ZoneDTO';
import { CloseButton } from '../Button/CloseButton';
import { useDialogFade } from '../Frame/useDialogFade';

function findLogAverage(player: string, bosses: ReportBossDTO[], selector: (a: ReportBossDTO) => ReportLogDTO[]): number {
    let sum = 0;
    let found = 0;

    for (const boss of bosses) {
        const logs = selector(boss);
        const log = logs.find(f => `${f.name}-${f.realm}` === player);

        if (log) {
            sum += log.log;
            found++;
        }
    }

    return found === 0 ? -1 : sum / found;
}

interface Props {
    scrollParent: HTMLDivElement;
    reports: ReportIndexEntry[];
    players: PlayerDTO[];
    zones?: ZoneDTO[];
}

function ReportDetails({ entry, renderDetails }: {
    entry: ReportIndexEntry;
    renderDetails: (report: ReportDTO) => React.ReactNode;
}) {
    const [report, setReport] = useState<ReportDTO>();
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        let active = true;
        setReport(undefined);
        setFailed(false);
        void loadReport(entry).then(data => { if (active) setReport(data); })
            .catch(() => { if (active) setFailed(true); });
        return () => { active = false; };
    }, [entry.file]);

    return <div className='reports-preview-content'>
        {report ? renderDetails(report) : <p>{failed ? 'Report details are unavailable.' : 'Loading report details...'}</p>}
    </div>;
}

function ReportPreview({ entry, anchor, scrollParent, zoneName, renderDetails, isClosing, onClose }: {
    entry: ReportIndexEntry;
    anchor: HTMLButtonElement;
    scrollParent: HTMLDivElement;
    zoneName?: string;
    renderDetails: (report: ReportDTO) => React.ReactNode;
    isClosing: boolean;
    onClose: () => void;
}) {
    const windowRef = useRef<HTMLDivElement>(null);
    const restoreFocus = useRef(true);
    const [position, setPosition] = useState<{ top: number; left: number }>();
    const previewWidth = Math.min(840, Math.max(300, 160 + entry.bosses.length * 38));

    useLayoutEffect(() => {
        const panel = windowRef.current!;
        const updatePosition = () => {
            const anchorRect = anchor.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();
            const gap = 8;
            const left = Math.max(gap, Math.min(
                anchorRect.left + (anchorRect.width - panelRect.width) / 2,
                window.innerWidth - panelRect.width - gap
            ));
            const below = anchorRect.bottom + gap;
            const above = anchorRect.top - panelRect.height - gap;
            const top = below + panelRect.height <= window.innerHeight - gap
                ? below
                : Math.max(gap, above);
            setPosition({ top, left });
        };
        updatePosition();
        const observer = new ResizeObserver(updatePosition);
        observer.observe(panel);
        window.addEventListener('resize', updatePosition);
        return () => { observer.disconnect(); window.removeEventListener('resize', updatePosition); };
    }, [anchor]);

    useEffect(() => {
        const panel = windowRef.current!;
        panel.querySelector<HTMLButtonElement>('.reports-preview-close')?.focus({ preventScroll: true });
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { onClose(); event.preventDefault(); }
        };
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !panel.contains(event.target) && !anchor.contains(event.target)) {
                restoreFocus.current = false;
                onClose();
            }
        };
        const onScroll = () => { restoreFocus.current = false; onClose(); };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', onPointerDown);
        scrollParent.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', onPointerDown);
            scrollParent.removeEventListener('scroll', onScroll);
            if (restoreFocus.current && anchor.isConnected) anchor.focus({ preventScroll: true });
        };
    }, [anchor, onClose, scrollParent]);

    return createPortal(
        <div ref={windowRef} className={`reports-preview-panel dialog-fade${isClosing ? ' dialog-fade-out' : ''}`}
            role='dialog' aria-modal='false' aria-hidden={isClosing}
            aria-labelledby='reports-preview-heading'
            style={{
                top: position?.top ?? -9999, left: position?.left ?? -9999, width: previewWidth,
                visibility: position ? 'visible' : 'hidden'
            }}>
            <CloseButton className='reports-preview-close' onClick={onClose} aria-label='Close report parses' />
            <h2 id='reports-preview-heading' className='reports-preview-title'>{entry.title}</h2>
            <p className='reports-preview-meta'>
                {zoneName && <span>{zoneName}</span>}
                <span>{entry.endTime ? calculateTimeDifference(entry.endTime) : 'In progress'}</span>
            </p>
            <ReportDetails entry={entry} renderDetails={renderDetails} />
            {!entry.code.startsWith('demo-') && (
                <a className='reports-external-link'
                    href={`https://classic.warcraftlogs.com/reports/${entry.code}`}
                    target='_blank' rel='noreferrer'>Open full report on Warcraft Logs</a>
            )}
        </div>, document.body
    );
}

export function Reports({ scrollParent, players: globalPlayers, reports: globalReports, zones }: Props): React.ReactNode {
    const reports = useMemo(() => {
        const reports = [...globalReports];
        reports.sort((a, b) => b.endTime - a.endTime);
        return reports;
    }, [globalReports]);
    const zoneNames = useMemo(() => new Map(zones?.map(zone => [zone.id, zone.name])), [zones]);
    const bossNames = useMemo(() => new Map(zones?.flatMap(zone => zone.bosses.map(boss => [boss.id, boss.name] as const))), [zones]);
    const [selectedReport, setSelectedReport] = useState<{ entry: ReportIndexEntry; anchor: HTMLButtonElement }>();
    const { isClosing, cancelClose, fadeOut } = useDialogFade();
    const closePreview = useCallback(() => fadeOut(() => setSelectedReport(undefined)), [fadeOut]);

    const buildLogs = useCallback((title: string, report: ReportDTO, selector: (a: ReportBossDTO) => ReportLogDTO[]): React.ReactNode => {
        const players = [...new Set(report.bosses.flatMap(f => selector(f)).map(f => `${f.name}-${f.realm}`))]
            .map(f => ({
                realmName: f,
                class: globalPlayers.find(p => `${p.name}-${p.realm}` === f)?.class ?? 'muted',
                log: findLogAverage(f, report.bosses, selector)
            }));

        players.sort((a, b) => b.log - a.log);

        return (
            <div className='report-log-group'>
                <div className='report-log-grid'>
                    <div className='report-log-names'>
                        <h3 className='report-log-heading'>{title}</h3>
                        {players.map(f => (
                            <p key={f.realmName} style={{ color: `var(--${f.class.toLowerCase().replaceAll(' ', '-')}-color)` }}>
                                {f.realmName.split('-')[0]}
                            </p>
                        ))}
                        {players.length === 0 && (<p className='report-log-empty'>No players found</p>)}
                    </div>
                    {report.bosses.map((boss, bossIndex) => {
                        const logs = [...selector(boss)];
                        const result = players.map(f => logs.find(s => `${s.name}-${s.realm}` === f.realmName));

                        return (
                            <div key={`${boss.id}-${bossIndex}`} className='report-log-boss'>
                                <img className='report-log-icon'
                                    src={boss.id < 0 ? Images.wowIcon : `https://assets.rpglogs.com/img/warcraft/bosses/${boss.id}-icon.jpg`}
                                    alt={bossNames.get(boss.id) ?? 'Boss'} />
                                {result.map((log, i) => (
                                    <p key={i} className={colorParse(log?.log ?? 0)}>
                                        {log && log.log !== -1 ? log.log.toFixed(0) : '-'}
                                    </p>
                                ))}
                                {result.length === 0 && (<p className='report-log-missing'>-</p>)}
                            </div>
                        );
                    })}
                </div>
            </div>
        )
    }, [bossNames, globalPlayers]);

    const renderDetails = useCallback((report: ReportDTO): React.ReactNode => (
        <div className='reports-parses'>
            {buildLogs('Damage Dealers', report, boss => boss.dps)}
            {buildLogs('Tanks', report, boss => boss.tanks)}
            {buildLogs('Healers', report, boss => boss.healers)}
        </div>
    ), [buildLogs]);

    return (
        <div className='reports-list'>
            <Virtuoso customScrollParent={scrollParent}
                totalCount={Math.ceil(reports.length / 2)}
                itemContent={(index) => {
                    return (
                        <div className='reports-pair'>
                            {reports.slice(index * 2, index * 2 + 2).map(report => (
                                <div className='reports-panel' key={report.code}>
                                    <button type='button' className='reports-row'
                                        onClick={event => {
                                            cancelClose();
                                            setSelectedReport({ entry: report, anchor: event.currentTarget });
                                        }}
                                        aria-label={`View parses for ${report.title}`}>
                                        <span className='reports-identity'>
                                            <strong className='reports-title'>{report.title}</strong>
                                            <span className='reports-meta'>
                                                {zoneNames.get(report.zoneId) && <span>{zoneNames.get(report.zoneId)}</span>}
                                                <span>{report.endTime ? calculateTimeDifference(report.endTime) : 'In progress'}</span>
                                            </span>
                                        </span>
                                        <span className='reports-bosses'>
                                            <span className='reports-boss-label'>Bosses</span>
                                            <span className='reports-boss-count'>{report.bosses.length}</span>
                                            {report.bosses.map((boss, bossIndex) => (
                                                <img key={`${boss.id}-${bossIndex}`}
                                                    className='reports-boss-icon'
                                                    src={boss.id < 0 ? Images.wowIcon : `https://assets.rpglogs.com/img/warcraft/bosses/${boss.id}-icon.jpg`}
                                                    alt={bossNames.get(boss.id) ?? 'Boss'} />
                                            ))}
                                        </span>
                                        <span className='reports-toggle-label'>View parses</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    );
                }}
            />

            {reports.length === 0 && (
                <h1 className='reports-empty'>No reports found</h1>
            )}
            {selectedReport && <ReportPreview key={selectedReport.entry.code} entry={selectedReport.entry} anchor={selectedReport.anchor}
                scrollParent={scrollParent} zoneName={zoneNames.get(selectedReport.entry.zoneId)}
                renderDetails={renderDetails} isClosing={isClosing} onClose={closePreview} />}
        </div>
    );
}
