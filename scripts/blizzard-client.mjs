const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export class BlizzardError extends Error {
    constructor(status, operation = 'API request') {
        super(status ? `Blizzard ${operation} returned HTTP ${status}.`
            : `Blizzard ${operation} did not return a complete, valid response.`);
        this.status = status;
        this.operation = operation;
    }

    get transient() { return [0, 408, 429, 500, 502, 503, 504].includes(this.status); }
}

function apiOperation(url) {
    if (url.pathname.startsWith('/data/wow/media/item/')) return 'item media';
    if (url.pathname.startsWith('/data/wow/item/')) return 'item catalog';
    if (url.pathname.startsWith('/profile/wow/character/')) return 'character details';
    return url.pathname.endsWith('/roster') ? 'guild roster' : 'guild summary';
}

// Tokens remain inside this closure. Never include remote bodies or transport errors
// in diagnostics: either can contain authentication material.
export function createBlizzardClient({ clientId, clientSecret, region, fetchImpl = fetch,
    intervalMs = 500, maxRetries = 3, sleep = pause }) {
    if (!['eu', 'us', 'tw', 'kr'].includes(region)) throw new Error('Invalid Blizzard region.');
    if (!clientId || !clientSecret) throw new Error('Blizzard client credentials are required.');
    const origin = `https://${region}.api.blizzard.com`;
    const namespace = `profile-forever-${region}`;
    let token;

    function apiUrl(path) {
        const url = new URL(path, origin);
        const catalogItem = /^\/data\/wow\/item\/[1-9]\d*$/.test(url.pathname);
        if (url.origin !== origin || url.username || url.password || url.hash ||
            (!catalogItem && !/^\/(?:data\/wow\/(?:guild|media\/item)\/|profile\/wow\/character\/)/.test(url.pathname)) ||
            [...url.searchParams.keys()].some(key => !['namespace', 'locale'].includes(key)))
            throw new Error('Refusing an unexpected Blizzard API URL.');
        const defaultNamespace = catalogItem ? `static-forever-${region}` : namespace;
        const requestedNamespace = url.searchParams.get('namespace') ?? defaultNamespace;
        if (requestedNamespace !== defaultNamespace &&
            !new RegExp(`^static-[a-zA-Z0-9_.]+-forever-${region}$`).test(requestedNamespace))
            throw new Error('Refusing a namespace outside WoW Forever.');
        url.searchParams.set('namespace', requestedNamespace);
        url.searchParams.set('locale', region === 'eu' ? 'en_GB' : 'en_US');
        return url;
    }

    async function requestJson(url, options, operation) {
        for (let attempt = 0; ; attempt++) {
            if (operation !== 'authentication') await sleep(intervalMs);
            let response;
            let status = 0;
            try {
                response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20_000) });
                if (response.ok) {
                    const data = await response.json();
                    if (data && typeof data === 'object') return data;
                } else {
                    status = response.status;
                    await response.body?.cancel();
                }
            } catch {
                // Fetch can also time out or lose the connection while reading the body.
            }
            const error = new BlizzardError(status, operation);
            if (!error.transient || attempt >= maxRetries) throw error;
            const retryAfterMs = Number(response?.headers.get('retry-after')) * 1000;
            await sleep(Math.min(30_000, Math.max(1000 * 2 ** attempt, Number.isFinite(retryAfterMs) ? retryAfterMs : 0)));
        }
    }

    async function authenticate() {
        const result = await requestJson('https://oauth.battle.net/token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ grant_type: 'client_credentials' }),
        }, 'authentication');
        if (typeof result.access_token !== 'string' || !result.access_token)
            throw new BlizzardError(0, 'authentication');
        token = result.access_token;
    }

    async function get(path) {
        const url = apiUrl(path);
        if (!token) await authenticate();
        return requestJson(url, { headers: { Authorization: `Bearer ${token}` } }, apiOperation(url));
    }

    return { get };
}
