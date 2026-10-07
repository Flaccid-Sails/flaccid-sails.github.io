import { CSSProperties, forwardRef, PropsWithChildren, Ref, useCallback, useEffect, useMemo, useRef } from 'react';
import { mergeRefs } from 'react-merge-refs';
import './scrollview.scss';
import { Images } from '@src/utils/images';

const STEP_BTN = 40;
const KNOB_HEIGHT = 26;

interface Props extends PropsWithChildren {
    style?: CSSProperties;
    className?: string;
    proportionalThumb?: boolean;
}

function ScrollViewComponent({ className, style, children, proportionalThumb = false }: Props, ref: Ref<HTMLDivElement>): React.ReactNode {
    const vpRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const viewportRef = useMemo(() => mergeRefs([ref, vpRef]), [ref]);
    const sbRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const btnUpRef = useRef<HTMLButtonElement>(null);
    const btnDnRef = useRef<HTMLButtonElement>(null);

    const trackRectRef = useRef<DOMRect>(undefined);
    const draggingRef = useRef<boolean>(false);
    const dragOffsetYRef = useRef<number>(0);

    const clamp = (n: number, min: number, max: number): number => {
        return Math.max(min, Math.min(max, n));
    };

    const refreshTrackRect = (): void => {
        trackRectRef.current = trackRef.current?.getBoundingClientRect();
    };

    const setThumbFromScroll = (): void => {
        if (!vpRef.current || !trackRef.current || !thumbRef.current) {
            return;
        }

        const maxScroll = vpRef.current.scrollHeight - vpRef.current.clientHeight;
        if (btnUpRef.current) btnUpRef.current.disabled = vpRef.current.scrollTop <= 0;
        if (btnDnRef.current) btnDnRef.current.disabled = vpRef.current.scrollTop >= maxScroll - 1;
        if (maxScroll <= 0) {
            thumbRef.current.style.display = 'none';
            thumbRef.current.style.top = '0px';
            return;
        }
        thumbRef.current.style.display = '';
        const thumbHeight = proportionalThumb
            ? Math.min(trackRef.current.clientHeight, Math.max(KNOB_HEIGHT, trackRef.current.clientHeight * vpRef.current.clientHeight / vpRef.current.scrollHeight))
            : KNOB_HEIGHT;
        thumbRef.current.style.height = thumbHeight + 'px';
        const maxThumbTop = Math.max(0, trackRef.current.clientHeight - thumbHeight);
        const pct = vpRef.current.scrollTop / maxScroll;
        const top = Math.round(pct * maxThumbTop);
        thumbRef.current.style.top = top + 'px';
    };

    const scrollFromThumb = useCallback((topPx: number): void => {
        const maxThumbTop = Math.max(0, trackRef.current!.clientHeight - thumbRef.current!.offsetHeight);
        const clampedTop = clamp(topPx, 0, maxThumbTop);
        const pct = maxThumbTop === 0 ? 0 : clampedTop / maxThumbTop;
        const maxScroll = Math.max(0, vpRef.current!.scrollHeight - vpRef.current!.clientHeight);
        vpRef.current!.scrollTop = Math.round(pct * maxScroll);
    }, []);

    const onPointerMove = useCallback((e: PointerEvent) => {
        if (!draggingRef.current) {
            return;
        }
        const y = e.clientY - trackRectRef.current!.top - dragOffsetYRef.current;
        scrollFromThumb(y);
    }, [scrollFromThumb]);

    const onPointerUp = useCallback(() => {
        draggingRef.current = false;
        document.removeEventListener('pointermove', onPointerMove);
    }, [onPointerMove]);

    const onPointerDown = useCallback((e: PointerEvent) => {
        if (e.button !== 0) {
            return;
        }
        draggingRef.current = true;
        refreshTrackRect();
        const thumbTop = thumbRef.current!.getBoundingClientRect().top;
        dragOffsetYRef.current = e.clientY - thumbTop;
        thumbRef.current!.setPointerCapture?.(e.pointerId);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp, { once: true });
        e.preventDefault();
    }, [onPointerMove, onPointerUp]);

    useEffect(() => {
        const viewport = vpRef.current!;
        const thumb = thumbRef.current!;
        const track = trackRef.current!;
        const up = btnUpRef.current!;
        const down = btnDnRef.current!;
        const scrollbar = sbRef.current!;
        const refresh = () => {
            refreshTrackRect();
            setThumbFromScroll();
        };
        const onTrackPointerDown = (e: PointerEvent) => {
            if (e.target === thumb) {
                return;
            }
            refreshTrackRect();
            const th = thumb.offsetHeight;
            const clickY = e.clientY - trackRectRef.current!.top;
            const thumbTop = parseFloat(getComputedStyle(thumb).top || '0');
            const page = viewport.clientHeight - 20;
            if (clickY < thumbTop) {
                viewport.scrollTop -= page;
            }
            else if (clickY > thumbTop + th) {
                viewport.scrollTop += page;
            }
        };
        const onUp = () => { viewport.scrollTop -= STEP_BTN; };
        const onDown = () => { viewport.scrollTop += STEP_BTN; };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') {
                viewport.scrollTop -= STEP_BTN; e.preventDefault();
            }
            else if (e.key === 'ArrowDown') {
                viewport.scrollTop += STEP_BTN; e.preventDefault();
            }
            else if (e.key === 'PageUp') {
                viewport.scrollTop -= (viewport.clientHeight - 20); e.preventDefault();
            }
            else if (e.key === 'PageDown') {
                viewport.scrollTop += (viewport.clientHeight - 20); e.preventDefault();
            }
            else if (e.key === 'Home') {
                viewport.scrollTop = 0; e.preventDefault();
            }
            else if (e.key === 'End') {
                viewport.scrollTop = viewport.scrollHeight; e.preventDefault();
            }
        };

        const ro = new ResizeObserver(refresh);
        ro.observe(viewport);
        ro.observe(contentRef.current!);
        viewport.addEventListener('scroll', setThumbFromScroll, { passive: true });
        window.addEventListener('resize', refresh);
        thumb.addEventListener('pointerdown', onPointerDown);
        track.addEventListener('pointerdown', onTrackPointerDown);
        up.addEventListener('click', onUp);
        down.addEventListener('click', onDown);
        scrollbar.addEventListener('keydown', onKeyDown);
        refresh();

        return () => {
            ro.disconnect();
            viewport.removeEventListener('scroll', setThumbFromScroll);
            window.removeEventListener('resize', refresh);
            thumb.removeEventListener('pointerdown', onPointerDown);
            track.removeEventListener('pointerdown', onTrackPointerDown);
            up.removeEventListener('click', onUp);
            down.removeEventListener('click', onDown);
            scrollbar.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            draggingRef.current = false;
        };
    }, [onPointerDown, onPointerMove, onPointerUp, proportionalThumb]);

    return (
        <div style={style} className={['scrollview', className].filter(Boolean).join(' ')}>
            <div ref={viewportRef}
                className='viewport'
            >
                <div ref={contentRef}>{children}</div>
            </div>

            <div ref={sbRef} tabIndex={-1} className='scrollbar' aria-hidden='true'>
                <button ref={btnUpRef}
                    className='arrow'
                    style={{ backgroundImage: `url(${Images.scrollUp})` }}
                    type='button'
                    aria-label='Scroll up' />
                <div ref={trackRef} className='track'>
                    <div ref={thumbRef}
                        className='thumb'
                        style={{ backgroundImage: `url(${Images.scrollKnob})` }}
                        draggable='false' />
                </div>
                <button ref={btnDnRef}
                    className='arrow'
                    style={{ backgroundImage: `url(${Images.scrollDown})` }}
                    type='button'
                    aria-label='Scroll down' />
            </div>
        </div>
    )
}

export const ScrollView = forwardRef(ScrollViewComponent);
