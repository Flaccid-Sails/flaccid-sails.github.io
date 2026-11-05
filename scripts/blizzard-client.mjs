const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export class BlizzardError extends Error {
    constructor(status, message = `Blizzard API returned HTTP ${status}.`) {
        super(message);
        this.status = status;
    }
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
        if (url.origin !== origin || url.username || url.password || url.hash ||
            !/^\/(?:data\/wow\/(?:guild|media\/item)\/|profile\/wow\/character\/)/.test(url.pathname) ||
            [...url.searchParams.keys()].some(key => !['namespace', 'locale'].includes(key)))
            throw new Error('Refusing an unexpected Blizzard API URL.');
        const requestedNamespace = url.searchParams.get('namespace') ?? namespace;
        if (requestedNamespace !== namespace &&
            !new RegExp(`^static-[a-zA-Z0-9_.]+-forever-${region}$`).test(requestedNamespace))
            throw new Error('Refusing a namespace outside WoW Forever.');
        url.searchParams.set('namespace', requestedNamespace);
        url.searchParams.set('locale', region === 'eu' ? 'en_GB' : 'en_US');
        return url;
    }

    async function request(url, options) {
        try {
            return await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20_000) });
        } catch {
            throw new BlizzardError(0, 'Blizzard request failed or timed out.');
        }
    }

    async function authenticate() {
        const response = await request('https://oauth.battle.net/token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ grant_type: 'client_credentials' }),
        });
        if (!response.ok) throw new BlizzardError(response.status, `Blizzard authentication failed (HTTP ${response.status}).`);
        const result = await response.json().catch(() => ({}));
        if (typeof result.access_token !== 'string' || !result.access_token)
            throw new BlizzardError(0, 'Blizzard authentication returned no token.');
        token = result.access_token;
    }

    async function get(path) {
        const url = apiUrl(path);
        if (!token) await authenticate();
        for (let attempt = 0; ; attempt++) {
            await sleep(intervalMs);
            const response = await request(url, { headers: { Authorization: `Bearer ${token}` } });
            if (response.ok) {
                const data = await response.json().catch(() => undefined);
                if (!data || typeof data !== 'object') throw new BlizzardError(0, 'Blizzard returned invalid JSON.');
                return data;
            }
            if (attempt >= maxRetries || ![429, 500, 502, 503, 504].includes(response.status))
                throw new BlizzardError(response.status);
            const retryAfter = Number(response.headers.get('retry-after'));
            await sleep(Math.min(30_000, Math.max(1000 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0)));
        }
    }

    return { get };
}
