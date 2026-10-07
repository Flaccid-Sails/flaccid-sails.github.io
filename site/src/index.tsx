import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import './index.scss';
import { App } from './components/App';
import { Images } from './utils/images';

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
