import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import './index.scss';
import { App } from './components/App';
import { Images } from './utils/images';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const firstVisit = !navigator.serviceWorker.controller;
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}image-sw.js`, { updateViaCache: 'none' })
            .then(() => navigator.serviceWorker.ready)
            .then(registration => {
                if (!firstVisit) return;
                registration.active?.postMessage({
                    type: 'CACHE_LOADED_IMAGES',
                    urls: performance.getEntriesByType('resource').map(entry => entry.name),
                });
            }).catch(() => {});
    });
}

document.body.style.setProperty('--char-cursor', `url(${Images.wowChatCursor})`);
document.body.style.setProperty('--cursor', `url(${Images.wowCursor})`);
document.body.style.setProperty('--engi-cursor', `url(${Images.wowEngiCursor})`);
document.body.style.setProperty('--flight-cursor', `url(${Images.wowFlightCursor})`);

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
