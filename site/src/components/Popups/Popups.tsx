import { EventEmitter } from '@src/utils/event-emitter';
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

type Side = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
const GAP = 2;

function place(
    rect: DOMRect,
    contentW: number,
    contentH: number,
    side: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    vw: number,
    vh: number
) {
    let top = 0, left = 0;

    if (side === 'RIGHT') {
        left = Math.max(rect.right + GAP, GAP);
        top = rect.top + (rect.height - contentH) / 2;

        const bottomOverflow = top + contentH - (vh - GAP);
        if (bottomOverflow > 0) top -= bottomOverflow;
        if (top < GAP) top = GAP;

    }
    else if (side === 'LEFT') {
        left = Math.min(rect.left - GAP - contentW, vw - GAP - contentW);
        top = rect.top + (rect.height - contentH) / 2;

        const bottomOverflow = top + contentH - (vh - GAP);
        if (bottomOverflow > 0) top -= bottomOverflow;
        if (top < GAP) top = GAP;

    }
    else if (side === 'UP') {
        top = rect.top - GAP - contentH;
        left = rect.left + (rect.width - contentW) / 2;

        if (left + contentW > vw - GAP) left = vw - GAP - contentW;
        if (left < GAP) left = GAP;

    }
    else {
        top = rect.bottom + GAP;
        left = rect.left + (rect.width - contentW) / 2;

        if (left + contentW > vw - GAP) left = vw - GAP - contentW;
        if (left < GAP) left = GAP;
    }

    if (side === 'RIGHT') {
        if (left + contentW > vw - GAP) left = vw - GAP - contentW;
    }
    else if (side === 'LEFT') {
        if (left < GAP) left = GAP;
    }
    else {
        if (top < GAP) top = GAP;
        if (top + contentH > vh - GAP) top = vh - GAP - contentH;
    }

    return { top, left };
}

export function Popups(): ReactNode {
    const [content, setContent] = useState<(() => ReactNode) | undefined>();
    const [coords, setCoords] = useState<{ top: number; left: number } | undefined>();
    const [pending, setPending] = useState<{ rect: DOMRect; side: Side } | undefined>();
    const [shouldHoverInside, setShouldHoverInside] = useState<boolean>(false);
    const [positioned, setPositioned] = useState<boolean>(false);

    const [hoverOutsideElement, setHoveredOutsideElement] = useState<boolean>(false);
    const [hoveredInsideElement, setHoveredInsideElement] = useState<boolean>(false);

    const removeTimeoutRef = useRef<NodeJS.Timeout>(undefined);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => EventEmitter.subscribe('CLOSE_POPUPS', () => {
        if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);
        setContent(undefined);
        setCoords(undefined);
        setPending(undefined);
        setPositioned(false);
        setShouldHoverInside(false);
        setHoveredOutsideElement(false);
        setHoveredInsideElement(false);
    }), []);

    const onMouseEnter = (): void => {
        if (shouldHoverInside) {
            setHoveredInsideElement(true);
        }
    };

    const onMouseLeave = (): void => {
        setHoveredInsideElement(false);
    };

    useEffect(() => {
        if (!hoveredInsideElement && !hoverOutsideElement) {
            setContent(undefined);
            setCoords(undefined);
            setPending(undefined);
            setPositioned(false);
            setShouldHoverInside(false);
        }
    }, [hoverOutsideElement, hoveredInsideElement]);

    useEffect(() => {
        return EventEmitter.subscribe('HOVER_ELEMENT', (event, side, nextContent, hovered, hoverInside) => {
            if (removeTimeoutRef.current) {
                clearTimeout(removeTimeoutRef.current);
                removeTimeoutRef.current = undefined;
            }

            if (!hovered) {
                removeTimeoutRef.current = setTimeout(() => {
                    removeTimeoutRef.current = undefined;
                    setHoveredOutsideElement(false);
                }, 100);
                return;
            }

            setShouldHoverInside(hoverInside);
            setContent(() => nextContent);
            setCoords({ top: -99999, left: -99999 });
            setHoveredOutsideElement(true);
            setPositioned(false);

            const rect = (event.currentTarget as Element).getBoundingClientRect();
            setPending({ rect, side });
        });
    }, []);

    useLayoutEffect(() => {
        if (!pending || !contentRef.current) {
            return;
        }
        const popup = contentRef.current;
        const position = () => {
            const { width, height } = popup.getBoundingClientRect();
            const { top, left } = place(pending.rect, width, height, pending.side, window.innerWidth, window.innerHeight);
            setCoords({ top, left });
            setPositioned(true);
        };
        position();
        const observer = new ResizeObserver(position);
        observer.observe(popup);
        return () => observer.disconnect();
    }, [pending, content]);

    return (
        <div ref={contentRef}
            style={{
                position: 'fixed',
                top: coords?.top,
                left: coords?.left,
                zIndex: 9999,
                visibility: positioned ? 'visible' : 'hidden',
                pointerEvents: positioned ? 'auto' : 'none',
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {content?.()}
        </div>
    );
}
