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

    return (
        <Frame theme={theme} className='charts-frame'>
            <aside style={{ backgroundImage: `url(${image})` }}>
                <ScrollView className='charts-scroll'>
                    <div className='charts-content'>
                        {players && <>
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
                        </>}
                    </div>
                </ScrollView>
            </aside>
        </Frame>
    );
}
