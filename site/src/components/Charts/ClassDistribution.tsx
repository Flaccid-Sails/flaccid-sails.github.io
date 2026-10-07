import { PlayerDTO } from '@src/models/PlayerDTO';
import { ReactNode, useMemo, useState } from 'react';
import ReactApexChart from 'react-apexcharts/core';
import 'apexcharts/polarArea';
import { Button } from '../Button/Button';
import { ApexOptions } from 'apexcharts';

const classes = ['Warrior', 'Mage', 'Rogue', 'Priest', 'Hunter', 'Warlock', 'Druid', 'Paladin', 'Shaman'];

interface Props {
    players: PlayerDTO[];
    maxLevel?: number;
    minimumRaidItemLevel?: number;
    computedStyle: CSSStyleDeclaration;
}

export function ClassDistribution({ players, maxLevel, minimumRaidItemLevel, computedStyle }: Props): ReactNode {
    const [filterCriteria, setFilterCriteria] = useState<string>('ALL');

    const filterComparers = useMemo(() => ({
        'ALL': () => true,
        'MAX LEVEL': (f: PlayerDTO) => f.level === maxLevel,
        'RAID READY': (f: PlayerDTO) => f.itemLevel >= (minimumRaidItemLevel ?? 0),
    } as Record<string, (f: PlayerDTO) => boolean>), [maxLevel, minimumRaidItemLevel]);

    const filteredPlayers = useMemo(
        () => players.slice().filter(filterComparers[filterCriteria]),
        [players, filterCriteria, filterComparers]
    );

    const chartData = useMemo(() => {
        const classDistributions = classes.map(label => {
            const classSlug = label.toLowerCase().replaceAll(' ', '-');
            return {
                label,
                count: filteredPlayers.filter(f => f.class === label).length,
                color: computedStyle.getPropertyValue(`--${classSlug}-color`)
            };
        }).sort((a, b) => b.count - a.count);

        return {
            options: {
                chart: {
                    type: 'polarArea',
                    background: 'transparent'
                },
                labels: classDistributions.map(f => f.label),
                colors: classDistributions.map(f => f.color),
                legend: {
                    show: false,
                },
                tooltip: {
                    custom(options) {
                        return `<div class="chart-tooltip">
                            <p class="chart-tooltip-title" style="color: ${options.w.globals.colors[options.seriesIndex]}">
                                ${options.w.globals.labels[options.seriesIndex]}
                            </p>
                            <p>Players: ${options.series[options.seriesIndex]}</p>
                        </div>`;
                    },
                },
                theme: {
                    mode: 'dark'
                },
                plotOptions: {
                    polarArea: {
                        spokes: {
                            strokeWidth: 0
                        },
                        rings: {
                            strokeWidth: 0
                        }
                    }
                }
            } as ApexOptions,
            series: classDistributions.map(f => f.count),
        };
    }, [computedStyle, filteredPlayers]);

    const sortClicked = (criteria: string): void => {
        if (!players || filterCriteria === criteria) {
            return;
        }
        setFilterCriteria(criteria);
    };

    return (
        <div className='class-distribution'>
            <p className='class-distribution-title'>Class distribution</p>
            <ReactApexChart
                type='polarArea'
                series={chartData.series}
                options={chartData.options}
                height={350}
            />
            <div className='class-distribution-chart'>
                {Object.keys(filterComparers).map(key => (
                    <Button key={key}
                        selected={key === filterCriteria}
                        onClick={() => sortClicked(key)}
                    >
                        {key}
                    </Button>
                ))}
            </div>
        </div>
    );
};
