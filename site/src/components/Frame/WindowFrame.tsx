import './window-frame.scss';

export const classPortrait = (characterClass: string) =>
    `${import.meta.env.BASE_URL}assets/talent-window/headers/class-icons/${characterClass.toLowerCase()}.webp`;

export function WindowFrame({ portrait }: { portrait: string }) {
    return <div className='wow-window-decoration' aria-hidden='true'>
        {['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].map(part =>
            <div key={part} className={`wow-window-frame wow-window-${part}`} />)}
        <img className='wow-window-portrait' src={portrait} alt='' />
        <div className='wow-window-portrait-frame' />
    </div>;
}
