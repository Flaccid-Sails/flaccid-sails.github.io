import { EventEmitter } from '@src/utils/event-emitter';
import { CSSProperties, MouseEvent, PropsWithChildren, ReactNode } from 'react';

interface Props extends PropsWithChildren {
    side: 'LEFT' | 'RIGHT' | 'DOWN' | 'UP';
    hoverWithin?: boolean;
    content: () => ReactNode;
    className?: string;
    style?: CSSProperties;
}

export function HoverElement({ content, side, hoverWithin, children, className, style }: Props): ReactNode {
    const hover = (event: MouseEvent<HTMLDivElement>, hovered: boolean): void => {
        EventEmitter.emit('HOVER_ELEMENT', event, side, content, hovered, hoverWithin ?? false);
    };

    return (
        <div style={style}
            className={className}
            onMouseEnter={e => hover(e, true)}
            onMouseLeave={e => hover(e, false)}
        >
            {children}
        </div>
    )
}