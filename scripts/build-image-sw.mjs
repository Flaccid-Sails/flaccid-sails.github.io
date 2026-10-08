import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../site/dist/', import.meta.url));
const paths = [];

async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await collect(path);
        else if (entry.name.endsWith('.webp')) paths.push(path);
    }
}

await collect(dist);
paths.sort();

const assets = Object.fromEntries(await Promise.all(paths.map(async path => [
    relative(dist, path).split('\\').join('/'),
    createHash('sha256').update(await readFile(path)).digest('hex').slice(0, 16),
])));

const worker = `const assets = ${JSON.stringify(assets)};
const scope = new URL(self.registration.scope);
const cacheName = 'flaccid-sails-images-v1:' + scope.pathname;

function assetPath(value) {
    const url = new URL(value, scope);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
    const path = decodeURIComponent(url.pathname.slice(scope.pathname.length));
    return assets[path] ? path : undefined;
}

function versionedUrl(path) {
    const url = new URL(path, scope);
    url.searchParams.set('v', assets[path]);
    return url.href;
}

self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) {
            const url = new URL(request.url);
            const path = decodeURIComponent(url.pathname.slice(scope.pathname.length));
            if (assets[path] !== url.searchParams.get('v')) await cache.delete(request);
        }
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || request.destination !== 'image') return;
    const path = assetPath(request.url);
    if (!path) return;
    const url = versionedUrl(path);
    event.respondWith((async () => {
        let cache;
        try {
            cache = await caches.open(cacheName);
            const saved = await cache.match(url);
            if (saved) return saved;
        } catch {}
        const response = await fetch(url);
        if (response.ok && cache) {
            try { await cache.put(url, response.clone()); } catch {}
        }
        return response;
    })());
});

self.addEventListener('message', event => {
    if (event.data?.type !== 'CACHE_LOADED_IMAGES' || !Array.isArray(event.data.urls)) return;
    event.waitUntil((async () => {
        const cache = await caches.open(cacheName);
        for (const entry of event.data.urls) {
            if (typeof entry !== 'string') continue;
            const path = assetPath(entry);
            if (!path) continue;
            const target = versionedUrl(path);
            if (await cache.match(target)) continue;
            try {
                let response = await fetch(new URL(path, scope), { cache: 'force-cache' });
                if (!response.ok) continue;
                const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
                const hash = Array.from(new Uint8Array(digest).slice(0, 8), byte => byte.toString(16).padStart(2, '0')).join('');
                if (hash !== assets[path]) response = await fetch(target);
                if (response.ok) await cache.put(target, response);
            } catch {}
        }
    })());
});
`;

await writeFile(join(dist, 'image-sw.js'), worker);
console.log(`Prepared image cache for ${paths.length} WebP files.`);
