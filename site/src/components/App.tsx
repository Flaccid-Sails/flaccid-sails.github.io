import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Snapshot } from '@src/models/Snapshot';
import { Theme } from '@src/models/Theme';
import { PlayerDTO } from '@src/models/PlayerDTO';
import { loadSnapshot } from '@src/utils/data';
import { realmToSlug } from '@src/utils/helpers';
import { EventEmitter } from '@src/utils/event-emitter';
import { Images } from '@src/utils/images';
import { CharacterDialog } from './Character/CharacterDialog';
const Charts = lazy(() => import('./Charts/Charts').then(module => ({ default: module.Charts })));
import { Frame } from './Frame/Frame';
import { Header } from './Header/Header';
import { JoinInfo } from './JoinInfo/JoinInfo';
import { Leaderboard } from './Leaderboard/Leaderboard';
import { Popups } from './Popups/Popups';
import { SpecializationsDialog } from './Specializations/SpecializationsDialog';

export function App() {
    const [wide, setWide] = useState(() => matchMedia('(min-width: 1280px)').matches);
    useEffect(() => {
        const query = matchMedia('(min-width: 1280px)');
        const update = () => setWide(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    const [snapshot, setSnapshot] = useState<Snapshot>();
    const [theme, setTheme] = useState<Theme>('HORDE');
    const [requestFailed, setRequestFailed] = useState(false);
    const parameters = snapshot?.parameters ?? {};
    const transformedPlayers = useMemo(() => snapshot?.players.map(player => ({
        ...player,
        ...(snapshot.logs[`${realmToSlug(player.realm)}-${player.name}`] ?? {}),
    } as PlayerDTO)), [snapshot]);

    useEffect(() => {
        let disposed = false;
        let fetching = false;
        async function refresh(force = false) {
            if (fetching) return;
            fetching = true;
            try {
                const data = await loadSnapshot(force);
                if (!disposed) { setSnapshot(data); setRequestFailed(false); }
            } catch {
                if (!disposed) setRequestFailed(true);
            } finally { fetching = false; }
        }
        void refresh();
        const onVisible = () => { if (!document.hidden) void refresh(true); };
        const timer = window.setInterval(onVisible, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', onVisible);
        return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
    }, []);

    useEffect(() => {
        try { setTheme((localStorage.getItem('flaccid-sails:theme') as Theme) || 'HORDE'); } catch {}
        return EventEmitter.subscribe('CHANGE_THEME', theme => {
            setTheme(theme);
            try { localStorage.setItem('flaccid-sails:theme', theme); } catch {}
        });
    }, []);

    const color = useMemo(() => {
        switch (theme) {
            case 'ALLIANCE':
                return '#0f4062';
            case 'HORDE':
                return '#49080a';
            case 'KYRIAN':
                return '#1f2638';
            case 'MARINE':
                return '#231d16';
            case 'MECHAGON':
                return '#393c37';
            case 'NECROLORD':
                return '#3d5849';
            case 'NEUTRAL':
                return '#432217';
            case 'NIGHT_FAE':
                return '#052033';
            case 'VENTHYR':
                return '#540a0b';
            case 'ORIBOS':
                return '#252d43';
        }
    }, [theme]);

    useEffect(() => {
        document.body.style.setProperty('--background-color', color);
    }, [color]);

    return <>
        <div className='app-backdrop' style={{ backgroundColor: color }} />
        <div className='app-backdrop' style={{ backgroundImage: `url(${Images.background})`, backgroundBlendMode: 'multiply', opacity: .85 }} />

        <Frame theme={theme} className='app-frame'
            contentClassName='app-frame-content'>
            <Header parameters={parameters} theme={theme} requestFailed={requestFailed} />
            {requestFailed && snapshot && <p role='status' className='app-status'>The latest refresh is unavailable. Showing the last loaded data.</p>}
            {snapshot && !parameters.lastUpdate && <p role='status' className='app-status'>Waiting for the first guild update.</p>}
            <main className='app-main'>
                {!snapshot && !requestFailed && <p role='status' className='app-loading'>Loading guild data...</p>}
                {requestFailed && !snapshot && (
                    <div className='app-error'>
                        Guild data is not available yet. Please try again later.
                    </div>
                )}
                {snapshot && <>
                    <Leaderboard players={transformedPlayers}
                        snapshot={snapshot}
                        zones={snapshot?.zones}
                        maxLevel={parameters.maxLevel}
                        minimumRaidItemLevel={parameters.minimumRaidItemLevel}
                        theme={theme}
                        hasLoaded={Boolean(parameters.lastUpdate)} />

                    {wide && <Suspense fallback={null}><Charts players={transformedPlayers}
                        maxLevel={parameters.maxLevel}
                        minimumRaidItemLevel={parameters.minimumRaidItemLevel}
                        theme={theme} /></Suspense>}
                </>}
            </main>
        </Frame>

        <JoinInfo theme={theme} color={color} />
        <CharacterDialog />
        <SpecializationsDialog players={snapshot?.players} />
        <Popups />
    </>;
}
