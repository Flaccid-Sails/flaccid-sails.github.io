import { PlayerDTO } from '@src/models/PlayerDTO';
import { Theme } from '@src/models/Theme';
import { themeToBackgroundImage } from '@src/utils/helpers';
import { ReactNode, useMemo } from 'react';
import { Frame } from '../Frame/Frame';
import { ScrollView } from '../ScrollView/ScrollView';
import { ClassDistribution } from './ClassDistribution';
import { HighestLog } from './HighestLog';

interface Props {
    players?: PlayerDTO[];
    maxLevel?: number;
    minimumRaidItemLevel?: number;
    theme: Theme;
}

export function Charts({ players, maxLevel, minimumRaidItemLevel, theme }: Props): ReactNode {
    const image = useMemo(() => themeToBackgroundImage(theme), [theme]);

    const computedStyle = useMemo(() => {
        return getComputedStyle(document.documentElement);
    }, [theme]);

    return (
        <Frame theme={theme} className='charts-frame'>
            <aside style={{ backgroundImage: `url(${image})` }}>
                <ScrollView className='charts-scroll'>
                    <div className='charts-content'>
                        {players && <>
                            <ClassDistribution players={players}
                                computedStyle={computedStyle}
                                maxLevel={maxLevel}
                                minimumRaidItemLevel={minimumRaidItemLevel} />
                            <HighestLog players={players}
                                computedStyle={computedStyle}
                                label='Highest logs dps'
                                selector={a => a.dps!}
                                max={100}
                                tooltipLabel='Log'
                                showOnlyIfFull
                                filterKilledBosses />
                            <HighestLog players={players}
                                computedStyle={computedStyle}
                                label='Highest logs healing'
                                selector={a => a.healer!}
                                max={100}
                                tooltipLabel='Log'
                                showOnlyIfFull
                                filterKilledBosses />
                            <HighestLog players={players}
                                computedStyle={computedStyle}
                                label='Highest raw DPS'
                                selector={a => a.rawDps!}
                                max={100}
                                tooltipLabel='Raw DPS'
                                showOnlyIfFull
                                filterKilledBosses />
                            <HighestLog players={players}
                                computedStyle={computedStyle}
                                label='Highest raw HPS'
                                selector={a => a.rawHps!}
                                max={100}
                                tooltipLabel='Raw HPS'
                                showOnlyIfFull
                                filterKilledBosses />
                        </>}
                    </div>
                </ScrollView>
            </aside>
        </Frame>
    );
}
