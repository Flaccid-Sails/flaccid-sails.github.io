import type { CharacterAppearance, ItemAppearance } from '../../models/CharacterAppearance';

export interface CharacterViewer {
    animate(on: boolean): boolean;
    spin(on: boolean): boolean;
    reset(): void;
    destroy(): void;
    state(): { missingGear: number; textured: boolean; drawn: [number | string, number, number, number][] };
}

export function mountCharacterViewer(host: HTMLElement, options: CharacterAppearance & {
    items: (ItemAppearance & { entry: number; slot?: string })[];
    animate: boolean;
    spin: boolean;
    cancelled: () => boolean;
}): Promise<CharacterViewer>;
