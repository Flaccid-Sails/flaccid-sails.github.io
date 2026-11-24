import { type ReactNode, useState } from 'react';
import type { PlayerApiDTO } from '@src/models/PlayerApiDTO';

interface Props {
    player?: PlayerApiDTO;
    fallback: string;
    className?: string;
    alt?: string;
    children?: ReactNode;
}

export function PlayerPortrait({ player, fallback, className, alt = '', children }: Props) {
    const [failedUrl, setFailedUrl] = useState<string>();
    const portrait = player?.level === 60 ? player.characterPortrait : undefined;
    const showPortrait = portrait && portrait !== failedUrl;
    const content = <>
        <img alt={alt} src={showPortrait ? portrait : fallback}
            onError={showPortrait ? () => setFailedUrl(portrait) : undefined} />
        {children}
    </>;
    if (player?.level !== 60) return <span className={className}>{content}</span>;

    const href = `https://forever.warcraftlogs.com/character/eu/normal/${encodeURIComponent(player.name.toLowerCase())}`;
    return <a className={className} href={href} target='_blank' rel='noreferrer'
        aria-label={`View ${player.name} on Warcraft Logs`}>{content}</a>;
}
