import { Theme } from '@src/models/Theme';
import { Images } from '@src/utils/images';
import { useState } from 'react';
import { Frame } from '../Frame/Frame';

interface Props {
    theme: Theme;
    color: string;
}

export function JoinInfo({ theme, color }: Props): React.ReactNode {
    const [open, setOpen] = useState<boolean>(false);

    const toggle = (): void => {
        setOpen(!open);
    };

    return <>
        {open && (
            <div className='join-panel'>
                <Frame theme={theme} contentClassName='join-panel-content' style={{ backgroundColor: color }}>
                    <iframe src='https://discord.com/widget?id=640994377791176752&theme=dark'
                        title='Flaccid Sails Discord'
                        width='350'
                        height='500'
                        frameBorder={0}
                        sandbox='allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts' />
                </Frame>
            </div>
        )}
        <div className='join-toggle'>
            <button className='button' onClick={toggle}>
                <img src={open ? Images.panelButtonUp : Images.panelButtonDown} alt='Up' />
            </button>
        </div>
    </>;
}
