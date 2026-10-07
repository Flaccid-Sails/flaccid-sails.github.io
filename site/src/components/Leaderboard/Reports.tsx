import { ReportDTO } from '@src/models/ReportDTO';
import { ReportIndexEntry } from '@src/models/ReportIndexEntry';
import { loadReport } from '@src/utils/data';
import { calculateTimeDifference, colorParse } from '@src/utils/helpers';
import { Virtuoso } from 'react-virtuoso';
import { HoverElement } from '../Popups/HoverElement';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Images } from '@src/utils/images';
import { ReportBossDTO } from '@src/models/ReportBossDTO';
import { ReportLogDTO } from '@src/models/ReportLogDTO';
import { PlayerDTO } from '@src/models/PlayerDTO';

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

    return <div className='report-tooltip'>
        {report ? renderDetails(report) : <p>{failed ? 'Report details are unavailable.' : 'Loading report details...'}</p>}
    </div>;
}

export function Reports({ scrollParent, players: globalPlayers, reports: globalReports }: Props): React.ReactNode {
    const reports = useMemo(() => {
        const reports = [...globalReports];
        reports.sort((a, b) => b.endTime - a.endTime);
        return reports;
    }, [globalReports]);

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
                    {report.bosses.map(boss => {
                        const logs = [...selector(boss)];
                        const result = players.map(f => logs.find(s => `${s.name}-${s.realm}` === f.realmName));

                        return (
                            <div key={boss.id} className='report-log-boss'>
                                <img className='report-log-icon'
                                    src={boss.id < 0 ? Images.wowIcon : `https://assets.rpglogs.com/img/warcraft/bosses/${boss.id}-icon.jpg`}
                                    alt='Boss' />
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
    }, [globalPlayers]);

    const tooltip = useCallback((entry: ReportIndexEntry): React.ReactNode => (
        <ReportDetails entry={entry} renderDetails={report =>
            <div className='report-tooltip-content'>
                {buildLogs('Damage Dealers', report, f => f.dps)}
                {buildLogs('Tanks', report, f => f.tanks)}
                {buildLogs('Healers', report, f => f.healers)}
            </div>
        } />
    ), [buildLogs]);

    return (
        <div className='reports-list'>
            <div className='reports-header'>
                <div className='reports-heading-title'>Title</div>
                <div className='reports-heading-ended'>Ended</div>
                <div className='reports-heading-bosses'>Bosses</div>
                <div className='reports-heading-logs'>Logs</div>
            </div>
            <Virtuoso customScrollParent={scrollParent}
                totalCount={reports.length}
                defaultItemHeight={56}
                itemContent={(index) => {
                    const report = reports[index];
                    return (
                        <a key={report.code}
                            className={'reports-row' + (index % 2 === 0 ? ' reports-row-striped' : '')}
                            href={report.code.startsWith('demo-') ? undefined : `https://classic.warcraftlogs.com/reports/${report.code}`}
                            target='_blank'
                            rel="noreferrer"
                        >
                            <div className='reports-cell-title'>
                                {report.title}
                            </div>
                            <div className='reports-cell-ended'>
                                {report.endTime ? calculateTimeDifference(report.endTime) : 'In progress'}
                            </div>
                            <div className='reports-cell-bosses'>
                                {report.bosses.map(f => (
                                    <img key={f.id}
                                        className='reports-boss-icon'
                                        src={f.id < 0 ? Images.wowIcon : `https://assets.rpglogs.com/img/warcraft/bosses/${f.id}-icon.jpg`}
                                        alt='Boss' />
                                ))}
                            </div>
                            <HoverElement className='reports-cell-logs'
                                side='LEFT'
                                hoverWithin={true}
                                content={() => tooltip(report)}
                            >
                                <img src={Images.alertButton} alt='alert' />
                            </HoverElement>
                        </a>
                    );
                }}
            />

            {reports.length === 0 && (
                <h1 className='reports-empty'>No reports found</h1>
            )}
        </div>
    );
}
