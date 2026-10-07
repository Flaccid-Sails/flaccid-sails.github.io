import { useCallback, useEffect, useRef, useState } from 'react';
import './dialog-fade.scss';

const FADE_DURATION_MS = 150;

export function useDialogFade() {
    const [isClosing, setIsClosing] = useState(false);
    const closeTimer = useRef<number | null>(null);

    const cancelClose = useCallback(() => {
        if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
        setIsClosing(false);
    }, []);

    const fadeOut = useCallback((onClosed: () => void) => {
        if (closeTimer.current !== null) return;
        setIsClosing(true);
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : FADE_DURATION_MS;
        closeTimer.current = window.setTimeout(() => {
            closeTimer.current = null;
            onClosed();
            setIsClosing(false);
        }, duration);
    }, []);

    useEffect(() => () => {
        if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    }, []);

    return { isClosing, cancelClose, fadeOut };
}
