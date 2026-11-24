import { useState } from 'react';
import type { PlayerApiDTO } from '@src/models/PlayerApiDTO';

interface Props {
    player?: PlayerApiDTO;
    fallback: string;
    className?: string;
    alt?: string;
}

export function PlayerPortrait({ player, fallback, className, alt = '' }: Props) {
    const [failedUrl, setFailedUrl] = useState<string>();
    const portrait = player?.level === 60 ? player.characterPortrait : undefined;
    const showPortrait = portrait && portrait !== failedUrl;
    return <img className={className} alt={alt} src={showPortrait ? portrait : fallback}
        onError={showPortrait ? () => setFailedUrl(portrait) : undefined} />;
}
