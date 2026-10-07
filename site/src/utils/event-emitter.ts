import { PlayerDTO } from '@src/models/PlayerDTO';
import { Theme } from '@src/models/Theme';
import { MouseEvent, ReactNode } from 'react';

type Events = {
    'OPEN_TALENTS': [];
    'OPEN_CHARACTER_DIALOG': [PlayerDTO];
    'OPEN_SPECIALIZATIONS_DIALOG': [PlayerDTO];
    'HOVER_ELEMENT': [MouseEvent<HTMLDivElement>, 'LEFT' | 'RIGHT' | 'DOWN' | 'UP', () => ReactNode, boolean, boolean];
    'CLOSE_POPUPS': [];
    'CHANGE_THEME': [Theme];
    'FETCH_ERROR': [];
};

export class EventEmitter {
    private static readonly subscribers: { [K in keyof Events]?: ((...params: Events[K]) => void)[] } = {};

    public static subscribe<K extends keyof Events>(event: K, callback: (...params: Events[K]) => void): () => void {
        if (!this.subscribers[event]) {
            this.subscribers[event] = [];
        }

        this.subscribers[event].push(callback);

        return () => {
            const index = this.subscribers[event]!.indexOf(callback);
            this.subscribers[event]!.splice(index, 1);
        };
    }

    public static emit<K extends keyof Events>(event: K, ...data: Events[K]): void {
        for (const subscriber of this.subscribers[event] || []) {
            subscriber(...data);
        }
    }
}
