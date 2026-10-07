import { CSSProperties } from 'react';
import { classPortrait } from '../Frame/WindowFrame';

interface Props {
    characterClass: string;
    label: string;
    value: number;
    max: number;
    displayValue: string;
    valueLabel: string;
}

export function ChartBar({ characterClass, label, value, max, displayValue, valueLabel }: Props) {
    const classSlug = characterClass.toLowerCase().replaceAll(' ', '-');
    const percent = max > 0 ? Math.max(0, Math.min(100, value / max * 100)) : 0;
    const color = `var(--${classSlug}-color)`;

    return <div className={`wow-chart-row${value === 0 ? ' wow-chart-row-empty' : ''}`}
        style={{ '--chart-color': color } as CSSProperties}>
        <img className='wow-chart-icon' src={classPortrait(characterClass)} alt='' />
        <span className='wow-chart-label' title={label}>{label}</span>
        <div className='wow-chart-track' role='meter' aria-label={`${label} ${valueLabel}`}
            aria-valuemin={0} aria-valuemax={Math.max(max, 1)}
            aria-valuenow={Math.max(0, Math.min(value, Math.max(max, 1)))}>
            <span className='wow-chart-fill' style={{ width: `${percent}%` }} />
        </div>
        <span className='wow-chart-value'>{displayValue}</span>
    </div>;
}
