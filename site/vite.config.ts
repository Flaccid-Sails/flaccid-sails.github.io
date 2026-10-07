import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    base: process.env.SITE_BASE_PATH || '/',
    plugins: [react()],
    resolve: { alias: { '@src': fileURLToPath(new URL('./src', import.meta.url)) } },
});
