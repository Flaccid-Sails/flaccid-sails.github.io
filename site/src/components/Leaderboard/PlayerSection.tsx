import { ReactNode } from 'react';
import { Section } from './Player';

interface Props {
    prevSection: Section | undefined;
    section: Section;
    isFirst: boolean;
}

export function PlayerSection({ prevSection, section, isFirst }: Props): ReactNode {
    return <>
        {!isFirst && (
            <div className={`player-section-divider ${prevSection?.hideIntermediate ? 'player-section-divider-wide' : 'player-section-divider-medium'}`}></div>
        )}
        <div className={`player-section ${section.hideIntermediate ? 'player-section-deferred' : ''}`}>
            <span className='player-section-label'>{section.title}</span>
            <div className={['player-section-value', section.className].filter(Boolean).join(' ')}
                style={section.style}
            >
                {section.content}
            </div>
        </div>
    </>;
}
