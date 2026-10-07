import { Theme } from "@src/models/Theme";
import { Images } from "./images";
import { PlayerDTO } from "@src/models/PlayerDTO";
import { readData } from "./data";
import { EventEmitter } from "./event-emitter";

const romanMap = [
    { value: 10, symbol: 'X' },
    { value: 9, symbol: 'IX' },
    { value: 5, symbol: 'V' },
    { value: 4, symbol: 'IV' },
    { value: 1, symbol: 'I' },
];

export function toRoman(num: number): string {
    if (num === 0) {
        return 'XXX';
    }

    let result = '';
    let remaining = num;

    for (const { value, symbol } of romanMap) {
        const count = Math.floor(remaining / value);
        if (count > 0) {
            result += symbol.repeat(count);
            remaining -= value * count;
        }
        if (remaining === 0) break;
    }

    return result;
}

export function transformParse(parse: number | undefined): string {
    if (typeof parse !== 'number' || Number.isNaN(parse) || parse === -1) {
        return '-';
    }
    else {
        return parse.toFixed(1);
    }
}

export function colorParse(parse: number | undefined): string {
    if (parse === undefined || parse === null || Number.isNaN(parse) || parse === -1) {
        return 'text-muted';
    }
    else if (parse < 25) {
        return 'gray-parse';
    }
    else if (parse < 50) {
        return 'green-parse';
    }
    else if (parse < 75) {
        return 'blue-parse';
    }
    else if (parse < 95) {
        return 'purple-normal-parse';
    }
    else if (parse < 99) {
        return 'orange-normal-parse';
    }
    else if (parse < 100) {
        return 'pink-normal-parse';
    }
    else {
        return 'yellow-normal-parse';
    }
}

export function formatWithCommas(input: number) {
    const str = String(input);
    const [integerPart, fractionPart] = str.split('.');

    const formattedInt = integerPart.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ','
    );

    return fractionPart !== undefined
        ? `${formattedInt}.${fractionPart}`
        : formattedInt;
}

export function getTimeDifferenceHHMM(date: number) {
    const diffMs = Math.abs(new Date().getTime() - date);

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    return `${mm}:${ss}`;
}

export function calculateTimeDifference(time: number, noHours = false): string {
    const totalMilliseconds = new Date().getTime() - time;
    const totalSeconds = totalMilliseconds / 1000;

    const years = Math.floor(totalSeconds / 31536000);
    const days = Math.floor((totalSeconds % 31536000) / 86400);
    const hours = Math.floor(((totalSeconds % 31536000) % 86400) / 3600);
    const minutes = Math.floor((((totalSeconds % 31536000) % 86400) % 3600) / 60);
    const seconds = Math.floor(((totalSeconds % 31536000) % 86400) % 3600) % 60;

    let result = '';

    if (years > 0) {
        if (years > 1) {
            result = years + ' years ago';
        }
        else {
            result = years + ' year ago';
        }
    }
    else if (days > 0) {
        if (days > 1) {
            result = days + ' days ago';
        }
        else {
            result = days + ' day ago';
        }
    }
    else if (noHours) {
        result = 'Today';
    }
    else if (hours > 0) {
        if (hours > 1) {
            result = hours + ' hours ago';
        }
        else {
            result = hours + ' hour ago';
        }
    }
    else if (minutes > 0) {
        if (minutes > 1) {
            result = minutes + ' minutes ago';
        }
        else {
            result = minutes + ' minute ago';
        }
    }
    else if (seconds > 1) {
        result = seconds + ' seconds ago';
    }
    else {
        result = 'just now';
    }

    return result.trimEnd();
}

export function safeHtmlPreview(html: string, limit = 1000): string {
    const voidTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    const escText = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
    const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&quot;').replace(/</g, '&lt;');

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<root>${html}</root>`, 'text/html');

    let out = '';
    let truncated = false;

    const write = (s: string) => {
        if (truncated) return;
        if (out.length + s.length <= limit) out += s;
        else {
            const room = limit - out.length;
            if (room > 0) out += s.slice(0, room);
            truncated = true;
        }
    };

    const openTag = (el: Element) => {
        let s = `<${el.tagName.toLowerCase()}`;
        for (const a of Array.from(el.attributes)) s += ` ${a.name}='${escAttr(a.value)}'`;
        s += '>';
        return s;
    };

    const closeTag = (el: Element) => `</${el.tagName.toLowerCase()}>`;

    const walk = (node: Node): void => {
        if (truncated) return;
        if (node.nodeType === Node.TEXT_NODE) { write(escText(node.nodeValue ?? '')); return; }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        const start = openTag(el);

        if (out.length + start.length > limit) { truncated = true; return; }
        write(start);

        if (!voidTags.has(tag)) {
            for (const child of Array.from(el.childNodes)) { walk(child); if (truncated) break; }
            write(closeTag(el));
        }
    };

    const root = doc.body.firstElementChild;
    if (root) {
        for (const n of Array.from(root.childNodes)) { walk(n); if (truncated) break; }
    }

    if (truncated) out += '<br /><br /> TOO LONG TO DISPLAY';
    return out;
}

export function themeToImage(theme: Theme): string {
    switch (theme) {
        case 'ALLIANCE':
            return Images.themeAlliance;
        case 'HORDE':
            return Images.themeHorde;
        case 'KYRIAN':
            return Images.themeKyrian;
        case 'MARINE':
            return Images.themeMarine;
        case 'MECHAGON':
            return Images.themeMechagon;
        case 'NECROLORD':
            return Images.themeNecrolord;
        case 'NEUTRAL':
            return Images.themeNeutral;
        case 'NIGHT_FAE':
            return Images.themeNightFae;
        case 'VENTHYR':
            return Images.themeVenthyr;
        case 'ORIBOS':
            return Images.themeOribos;
    }
}

export function themeToBackgroundImage(theme: Theme): string {
    switch (theme) {
        case 'ALLIANCE':
            return Images.themeAllianceBackground;
        case 'HORDE':
            return Images.themeHordeBackground;
        case 'KYRIAN':
            return Images.themeKyrianBackground;
        case 'MARINE':
            return Images.themeMarineBackground;
        case 'MECHAGON':
            return Images.themeMechagonBackground;
        case 'NECROLORD':
            return Images.themeNecrolordBackground;
        case 'NEUTRAL':
            return Images.themeNeutralBackground;
        case 'NIGHT_FAE':
            return Images.themeNightFaeBackground;
        case 'ORIBOS':
            return Images.themeOribosBackground;
        case 'VENTHYR':
            return Images.themeVenthyrBackground;
    }
}

function getLoginDate(date: number): number {
    if (date === -1) {
        return Number.MAX_SAFE_INTEGER;
    }
    return date;
}

function getScore(obj: PlayerDTO): number {
    const d = (typeof obj.dps === 'number' && obj.dps >= 0) ? obj.dps : -1;
    const h = (typeof obj.healer === 'number' && obj.healer >= 0) ? obj.healer : -1;
    const t = (typeof obj.tank === 'number' && obj.tank >= 0) ? obj.tank : -1;
    return Math.max(d, h, t);
}

function getDifficulty(obj: PlayerDTO): number {
    return (typeof obj.difficulty === 'number' && obj.difficulty >= 0 && getScore(obj) !== -1)
        ? obj.difficulty
        : 0;
}

function getKilledBosses(obj: PlayerDTO): number {
    return (typeof obj.killedBosses === 'number' && obj.killedBosses >= 0 && getScore(obj) !== -1)
        ? obj.killedBosses
        : 0;
}

function sortLog(a: PlayerDTO, b: PlayerDTO): number {
    const diffDA = getDifficulty(a);
    const diffDB = getDifficulty(b);
    if (diffDB !== diffDA) {
        return diffDB - diffDA;
    }

    const diffKBA = getKilledBosses(a);
    const diffKBB = getKilledBosses(b);
    if (diffKBB !== diffKBA) {
        return diffKBB - diffKBA;
    }
    return getScore(b) - getScore(a);
}

export const sortComparers: Record<string, (a: PlayerDTO, b: PlayerDTO, order: 'ASC' | 'DESC') => number> = {
    'LOG': (a, b, order) => {
        const result = sortLog(a, b);
        return order === 'ASC' ? -result : result;
    },
    'ITEM LEVEL': (a, b, order) => {
        const result = (b.itemLevel || 0) - (a.itemLevel || 0);
        return order === 'ASC' ? -result : result;
    },
    'LOGGED IN': (a, b, order) => {
        const result = getLoginDate(a.lastLogin) - getLoginDate(b.lastLogin);
        return order === 'ASC' ? -result : result;
    }
};

export function realmToSlug(realm: string): string {
    return realm.toLowerCase().replace(/ /g, '-');
}

interface FetchProps<T> {
    url: string;
    noErrorEmit?: boolean;
    onResponse(data: T): void;
    onError?(): void;
}

export async function pullDataFromUrl<T>(props: FetchProps<T>): Promise<void> {
    try {
        const data = await readData<T>(props.url);
        props.onResponse(data);
    }
    catch {
        if (!props.noErrorEmit) {
            EventEmitter.emit('FETCH_ERROR');
        }
        props.onError?.();
    }
}
