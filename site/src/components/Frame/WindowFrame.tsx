import type { PlayerApiDTO } from '@src/models/PlayerApiDTO';
import { PlayerPortrait } from '../Portrait/PlayerPortrait';
import './window-frame.scss';

export const classPortrait = (characterClass: string) =>
    `${import.meta.env.VITE_ARTWORK_BASE_URL}assets/talent-window/headers/class-icons/${characterClass.toLowerCase()}.webp`;

interface Props {
    portrait: string;
    player?: PlayerApiDTO;
}

export function WindowFrame({ portrait, player }: Props) {
    return <div className='wow-window-decoration' aria-hidden='true'>
        {['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].map(part =>
            <div key={part} className={`wow-window-frame wow-window-${part}`} />)}
        <PlayerPortrait player={player} fallback={portrait} className='wow-window-portrait' />
        <div className='wow-window-portrait-frame' />
    </div>;
}
