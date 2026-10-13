import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const base = process.env.SITE_BASE_PATH || '/';
const artworkBase = process.env.ARTWORK_BASE_URL;

export default defineConfig({
    base,
    define: { 'import.meta.env.VITE_ARTWORK_BASE_URL': JSON.stringify(artworkBase || base) },
    experimental: {
        renderBuiltUrl(filename, { type }) {
            if (artworkBase && type === 'public' && filename.startsWith('assets/'))
                return new URL(filename, artworkBase).href;
        },
    },
    plugins: [react()],
    resolve: { alias: { '@src': fileURLToPath(new URL('./src', import.meta.url)) } },
});
