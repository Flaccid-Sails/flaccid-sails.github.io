import { PlayerDTO } from '@src/models/PlayerDTO';
import { ReportIndexEntry } from '@src/models/ReportIndexEntry';
import { DashboardBossDTO } from '@src/models/DashboardBossDTO';
import { Snapshot } from '@src/models/Snapshot';
import { Theme } from '@src/models/Theme';
import { ZoneDTO } from '@src/models/ZoneDTO';
import { loadDashboard, loadReportIndex } from '@src/utils/data';
import { sortComparers, themeToBackgroundImage } from '@src/utils/helpers';
import { Images } from '@src/utils/images';
import { FormEvent, ReactNode, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Button } from '../Button/Button';
import { Frame } from '../Frame/Frame';
import { ScrollView } from '../ScrollView/ScrollView';
import { TextInput } from '../TextInput/TextInput';
const Dashboard = lazy(() => import('./Dashboard').then(module => ({ default: module.Dashboard })));
import { Player } from './Player';
import { Reports } from './Reports';
import './leaderboard.scss';

type TabType = 'PLAYERS' | 'REPORTS' | 'DASHBOARD';

interface Tab {
    type: TabType;
    title: string;
}

interface Props {
    players?: PlayerDTO[];
    zones?: ZoneDTO[];
    maxLevel?: number;
    minimumRaidItemLevel?: number;
    theme: Theme;
    snapshot: Snapshot;
    hasLoaded: boolean;
}

export function Leaderboard({
    players: globalPlayers,
    snapshot,
    zones,
    minimumRaidItemLevel,
    hasLoaded,
    maxLevel,
    theme
}: Props): ReactNode {
    const [searchQuery, setSearchQuery] = useState<string>();
    const [sortedCriteria, setSortedCriteria] = useState<keyof typeof sortComparers>('LOG');
    const [selectedTab, setSelectedTab] = useState<TabType>('PLAYERS');
    const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC');
    const [reportData, setReportData] = useState<{ file: string; reports: ReportIndexEntry[] }>();
    const [dashboardData, setDashboardData] = useState<{ file: string; bosses: DashboardBossDTO[] }>();
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (selectedTab === 'PLAYERS') return;
        let active = true;
        setLoadError(false);
        if (selectedTab === 'REPORTS') {
            void loadReportIndex(snapshot).then(reports => {
                if (active) setReportData({ file: snapshot.reportIndexFile, reports });
            }).catch(() => { if (active) setLoadError(true); });
        } else {
            void loadDashboard(snapshot).then(bosses => {
                if (active) setDashboardData({ file: snapshot.dashboardFile, bosses });
            }).catch(() => { if (active) setLoadError(true); });
        }
        return () => { active = false; };
    }, [selectedTab, snapshot]);

    const globalReports = reportData?.file === snapshot.reportIndexFile ? reportData.reports : undefined;
    const dashboardBosses = dashboardData?.file === snapshot.dashboardFile ? dashboardData.bosses : undefined;

    const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);

    const tabs = useMemo((): Tab[] => [
        {
            type: 'PLAYERS',
            title: 'Players'
        },
        {
            type: 'REPORTS',
            title: 'Reports'
        },
        {
            type: 'DASHBOARD',
            title: 'Dashboard',
        }
    ], []);

    const sortedPlayers = useMemo(() => {
        const players = globalPlayers?.slice();
        if (sortedCriteria && players) {
            players.sort((a, b) => {
                const primary = sortComparers[sortedCriteria](a, b, sortDirection);
                if (primary) return primary;
                return a.name.localeCompare(b.name);
            });
        }
        return players;
    }, [globalPlayers, sortedCriteria, sortDirection]);

    const players = useMemo(() => {
        if (!searchQuery || !sortedPlayers) {
            return sortedPlayers;
        }

        return sortedPlayers.filter(player =>
            [player.name, player.class, player.realm]
                .map(f => f.toLowerCase())
                .some(f => f.includes(searchQuery))
        );
    }, [searchQuery, sortedPlayers]);

    const reports = useMemo(() => {
        if (!searchQuery || !globalReports) {
            return globalReports;
        }

        return globalReports.filter(report =>
            report.title.toLowerCase().includes(searchQuery)
        );
    }, [searchQuery, globalReports]);

    const backgroundImage = useMemo(() => themeToBackgroundImage(theme), [theme]);

    const sortClicked = (criteria: keyof typeof sortComparers): void => {
        if (!globalPlayers) {
            return;
        }
        else if (sortedCriteria === criteria) {
            setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
            return;
        }

        setSortedCriteria(criteria);
        setSortDirection('DESC');
    };

    const search = (event: FormEvent<HTMLInputElement>): void => {
        setSearchQuery(event.currentTarget!.value.toLowerCase());
    };

    const tabTapped = (tab: TabType): void => {
        if (selectedTab === tab) {
            return;
        }

        setSelectedTab(tab);
        setSearchQuery('');

    };

    const frameBackground = selectedTab === 'DASHBOARD'
        ? `url(${backgroundImage})`
        : `url(${Images.background})`;

    return (
        <section className='leaderboard-root'>
            <div className='leaderboard-toolbar'>
                <div className='leaderboard-search'>
                    <TextInput placeholder='Search' text={searchQuery} onInput={search} />
                </div>
                {selectedTab === 'PLAYERS' && (
                    <div className='leaderboard-sort-controls'>
                        <p className='leaderboard-sort-label'>Sort by</p>
                        {Object.keys(sortComparers).map(key => (
                            <Button key={key}
                                className='leaderboard-sort-button'
                                selected={key === sortedCriteria}
                                onClick={() => sortClicked(key as keyof typeof sortComparers)}
                            >
                                {key}
                                {key === sortedCriteria && (
                                    <img className={`leaderboard-sort-arrow${sortDirection === 'ASC' ? ' ascending' : ''}`}
                                        src={Images.sortArrow}
                                        alt={sortDirection === 'ASC' ? 'Ascending' : 'Descending'} />
                                )}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
            <Frame theme={theme} className='leaderboard-frame' contentClassName='leaderboard-frame-content'
                style={{ backgroundImage: frameBackground }}>
                <ScrollView ref={setScrollParent} className='leaderboard-scroll'>
                    {selectedTab === 'PLAYERS' && <>
                        {!players && (
                            <h1 className='leaderboard-message'>Loading...</h1>
                        )}
                        {players && scrollParent && (
                            <Virtuoso customScrollParent={scrollParent}
                                totalCount={players.length}
                                defaultItemHeight={123}
                                itemContent={(index) => {
                                    const player = players[index];
                                    return (
                                        <Player key={player.name}
                                            player={player}
                                            maxLevel={maxLevel}
                                            sortedCriteria={sortedCriteria}
                                            zones={zones} />
                                    );
                                }}
                            />
                        )}
                        {players && players.length === 0 && (
                            <h1 className='leaderboard-message'>No players found</h1>
                        )}
                    </>}
                    {selectedTab === 'REPORTS' && <>
                        {!reports && (
                            <h1 className='leaderboard-message'>{loadError ? 'Reports are unavailable.' : 'Loading...'}</h1>
                        )}
                        {reports && scrollParent && (
                            <Reports scrollParent={scrollParent} reports={reports} players={globalPlayers ?? []} />
                        )}
                    </>}
                    {selectedTab === 'DASHBOARD' && <>
                        {(!dashboardBosses || !globalPlayers) && (
                            <h1 className='leaderboard-message'>{loadError ? 'Dashboard is unavailable.' : 'Loading...'}</h1>
                        )}
                        {dashboardBosses && globalPlayers && (
                            <Suspense fallback={<p className='leaderboard-dashboard-loading'>Loading dashboard...</p>}><Dashboard theme={theme}
                                maxLevel={maxLevel}
                                minimumRaidItemLevel={minimumRaidItemLevel}
                                players={globalPlayers}
                                bosses={dashboardBosses}
                                searchText={searchQuery} /></Suspense>
                        )}
                    </>}
                </ScrollView>
            </Frame>
            {players && hasLoaded && (
                <div className='leaderboard-bottom-tabs' aria-label='Guild data'>
                    {tabs.map((tab) => (
                        <button key={tab.type} type='button' aria-pressed={selectedTab === tab.type}
                            className={`button leaderboard-bottom-tab${selectedTab === tab.type ? ' active' : ''}`}
                            onClick={() => tabTapped(tab.type)}
                        >
                            <span>{tab.title}</span>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
