import { PlayerDTO } from '@src/models/PlayerDTO';
import { ApexOptions } from 'apexcharts';
import { ReactNode, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts/core';
import 'apexcharts/bar';

interface Props {
    players: PlayerDTO[];
    maxLevel?: number;
    computedStyle: CSSStyleDeclaration;
    label?: string;
    max?: number;
    tooltipLabel: string;
    showOnlyIfFull?: boolean;
    filterKilledBosses?: boolean;
    labelFormatter?(value: string): string;
    selector: (f: PlayerDTO) => number;
}

export function HighestLog({
    players,
    computedStyle,
    label,
    max,
    tooltipLabel,
    showOnlyIfFull,
    filterKilledBosses,
    selector,
    labelFormatter,
}: Props): ReactNode {
    const chartData = useMemo(() => {
        const maxDifficulty = Math.max(...new Set(players.filter(f => f.difficulty).map(f => f.difficulty!)));
        const maxKilledBosses = Math.max(...new Set(players.filter(f => f.killedBosses).map(f => f.killedBosses!)));

        let filteredPlayers = players
            .filter(f => selector(f) && selector(f) > 0);

        const maxDifficultyPlayers = filteredPlayers
            .filter(f => f.difficulty === maxDifficulty && (!filterKilledBosses || f.killedBosses === maxKilledBosses));

        if (maxDifficultyPlayers.length >= 5) {
            filteredPlayers = maxDifficultyPlayers;
        }

        const highestLogData = filteredPlayers
            .sort((a, b) => selector(b) - selector(a))
            .slice(0, 5);

        return {
            options: {
                chart: {
                    type: 'bar',
                    height: 184,
                    toolbar: { show: false },
                    background: 'transparent',
                    border: 0,
                    dropShadow: { enabled: false },
                },
                plotOptions: {
                    bar: {
                        horizontal: true,
                        borderRadius: 2,
                        barHeight: '60%',
                    },
                },
                dataLabels: {
                    enabled: false,
                },
                theme: {
                    mode: 'dark'
                },
                xaxis: {
                    categories: highestLogData.map(f => f.name),
                    min: 0,
                    max: max,
                    labels: {
                        formatter: labelFormatter,
                    },
                },
                legend: {
                    show: false,
                },
                colors: highestLogData.map(f => {
                    const cssVar = `--${f.class.toLowerCase().replaceAll(' ', '-')}-color`;
                    return computedStyle.getPropertyValue(cssVar);
                }),
                tooltip: {
                    custom(options) {
                        const text = options.series[options.seriesIndex][options.dataPointIndex].toFixed(2);
                        return `<div class="chart-tooltip">
                            <p class="chart-tooltip-title" style="color: ${options.w.globals.colors[options.dataPointIndex]}">
                                ${options.w.globals.labels[options.dataPointIndex]}
                            </p>
                            <p>
                                ${tooltipLabel}:
                                ${labelFormatter ? labelFormatter(text) : text}
                            </p>
                        </div>`;
                    },
                },
                title: {
                    text: undefined,
                },
            } as ApexOptions,
            series: [{
                data: highestLogData.map(f => {
                    const cssVar = `--${f.class.toLowerCase().replaceAll(' ', '-')}-color`;
                    return {
                        x: f.name,
                        y: selector(f),
                        fillColor: computedStyle.getPropertyValue(cssVar),
                    };
                }),
            }] as ApexOptions['series'],
            length: highestLogData.length,
        };
    }, [computedStyle, players, max, tooltipLabel, filterKilledBosses, selector, labelFormatter]);

    if (showOnlyIfFull && chartData.length < 5) {
        return <></>;
    }

    return (
        <div className='highest-log'>
            {label && <p className='highest-log-title'>{label}</p>}
            <div className='highest-log-chart'>
                <ReactApexChart options={chartData.options}
                    series={chartData.series}
                    type='bar'
                    height={184}
                />
            </div>
        </div>
    );
};
