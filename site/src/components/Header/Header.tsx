import { ParametersDTO } from '@src/models/ParametersDTO';
import { Theme } from '@src/models/Theme';
import { EventEmitter } from '@src/utils/event-emitter';
import { calculateTimeDifference, themeToImage } from '@src/utils/helpers';
import { Images } from '@src/utils/images';
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { HoverElement } from '../Popups/HoverElement';

interface Props {
    parameters: ParametersDTO;
    theme: Theme;
    requestFailed: boolean;
}

export function Header({ parameters, theme, requestFailed }: Props): React.ReactNode {
    const [time, setTime] = useState<string>();
    const [, setLastUpdated] = useState<string>();
    const [hasTabFocus, setHasTabFocus] = useState<boolean>(true);

    const changeTime = () => {
        const dateTimeString = new Date().toUTCString();
        const timeString = dateTimeString.split(' ')[4];
        const timeParts = timeString.split(':');
        timeParts[0] = String((parseInt(timeParts[0]) + 2) % 24);
        setTime(timeParts.join(':'));
    };

    const changeLastUpdate = useCallback((): void => {
        if (parameters.lastUpdate && parameters.lastLogsUpdate) {
            setLastUpdated(calculateTimeDifference(Math.max(parameters.lastUpdate, parameters.lastLogsUpdate) * 1000));
        }
    }, [parameters]);

    const changeTheme = (theme: Theme): void => {
        EventEmitter.emit('CHANGE_THEME', theme);
    };

    useEffect(() => {
        changeTime();
        const interval = setInterval(changeTime, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        function onChange() {
            setHasTabFocus(!document.hidden);
        }

        document.addEventListener('visibilitychange', onChange);
        return () => document.removeEventListener('visibilitychange', onChange);
    }, []);

    useEffect(() => {
        if (parameters.lastUpdate && hasTabFocus) {
            changeLastUpdate();
            const interval = setInterval(changeLastUpdate, 1000);

            return () => clearInterval(interval);
        }

        return () => { };
    }, [changeLastUpdate, parameters, hasTabFocus]);

    const getHeaderStyle = (theme: Theme): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${themeToImage(theme)})`,
            backgroundSize: 780,
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))'
        };

        switch (theme) {
            case 'ALLIANCE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -49,
                };
            case 'HORDE':
                return fixedStyle;
            case 'KYRIAN':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -25,
                    width: 'calc(100% - 70px)',
                    margin: '0 35px'
                };
            case 'MARINE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -49,
                };
            case 'MECHAGON':
                return fixedStyle;
            case 'NECROLORD':
                return {
                    ...fixedStyle,
                    width: 'calc(100% - 70px)',
                    margin: '0 35px'
                };
            case 'NEUTRAL':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -25,
                };
            case 'NIGHT_FAE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -49,
                    width: 'calc(100% - 70px)',
                    margin: '0 35px'
                };
            case 'VENTHYR':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -49,
                    width: 'calc(100% - 70px)',
                    margin: '0 35px'
                };
            case 'ORIBOS':
                return {
                    ...fixedStyle,
                    width: 'calc(100% - 100px)',
                    margin: '0 50px',
                    backgroundSize: 168,
                    backgroundPositionY: 5,
                    height: 62
                };
        }
    };

    const getLeftStyle = (theme: Theme): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${themeToImage(theme)})`,
            backgroundSize: 780,
        };

        switch (theme) {
            case 'ALLIANCE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -274.5,
                    backgroundPositionX: -590,
                };
            case 'HORDE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -207,
                    backgroundPositionX: -615,
                };
            case 'KYRIAN':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -205.6,
                    backgroundPositionX: -425,
                };
            case 'MARINE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -510,
                    backgroundPositionX: -590,
                };
            case 'MECHAGON':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -205.6,
                    backgroundPositionX: -425,
                };
            case 'NECROLORD':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -327.8,
                    backgroundPositionX: -587,
                };
            case 'NEUTRAL':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -115.8,
                    backgroundPositionX: -590,
                };
            case 'NIGHT_FAE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -450.4,
                    backgroundPositionX: -625,
                };
            case 'VENTHYR':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -115.4,
                    backgroundPositionX: -180,
                };
            case 'ORIBOS':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -540,
                    backgroundPositionX: 3,
                    backgroundSize: 168,
                    height: 57,
                    marginTop: 4.9
                };
        }
    };

    const getRightStyle = (theme: Theme): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${themeToImage(theme)})`,
            backgroundSize: 780,
        };

        switch (theme) {
            case 'ALLIANCE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -340.5,
                    backgroundPositionX: -590,
                };
            case 'HORDE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -207,
                    backgroundPositionX: -460,
                };
            case 'KYRIAN':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -205.6,
                    backgroundPositionX: -585,
                };
            case 'MARINE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -444,
                    backgroundPositionX: -590,
                };
            case 'MECHAGON':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -205.6,
                    backgroundPositionX: -585,
                };
            case 'NECROLORD':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -535,
                    backgroundPositionX: -625,
                };
            case 'NEUTRAL':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -181.8,
                    backgroundPositionX: -590,
                };
            case 'NIGHT_FAE':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -516.6,
                    backgroundPositionX: -625,
                };
            case 'VENTHYR':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -115.4,
                    backgroundPositionX: -5,
                };
            case 'ORIBOS':
                return {
                    ...fixedStyle,
                    backgroundPositionY: -597,
                    backgroundPositionX: 16,
                    backgroundSize: 168,
                    height: 57,
                    marginTop: 4.9
                };
        }
    };

    const headerStyle = useMemo((): CSSProperties => getHeaderStyle(theme), [theme]);
    const leftStyle = useMemo((): CSSProperties => getLeftStyle(theme), [theme]);
    const rightStyle = useMemo((): CSSProperties => getRightStyle(theme), [theme]);

    const tooltipButton = (theme: Theme): React.ReactNode => {
        const leftStyle = { ...getLeftStyle(theme), height: 66, width: 153 } as CSSProperties;
        const rightStyle = { ...getRightStyle(theme), height: 66, width: 153 } as CSSProperties;
        const themeStyle = {
            textShadow: 'black 0 0 4px',
            fontWeight: 'bold'
        };

        return (
            <div className='header-theme-choice' onClick={() => changeTheme(theme)}>
                <div className='header-theme-left' style={leftStyle} />
                <div className='header-theme-right' style={rightStyle} />
                <div style={themeStyle} className='header-theme-label'>
                    {theme}
                </div>
            </div>
        );
    };

    const tooltip = (): React.ReactNode => {
        return (
            <div className='header-theme-options'>
                {tooltipButton('ALLIANCE')}
                {tooltipButton('HORDE')}
                {tooltipButton('KYRIAN')}
                {tooltipButton('MARINE')}
                {tooltipButton('NECROLORD')}
                {tooltipButton('NEUTRAL')}
                {tooltipButton('NIGHT_FAE')}
                {tooltipButton('VENTHYR')}
                {tooltipButton('ORIBOS')}
            </div>
        );
    };

    const textShadow = 'rgba(0, 0, 0, 0.7) 1px 0 5px';

    return (
        <header className='site-header'>
            <div className='header-background' style={headerStyle} />
            <div className='header-left-decoration' style={leftStyle} />
            <div className='header-right-decoration' style={rightStyle} />
            <div className='header-content'>
                <a className='header-brand'
                    href={import.meta.env.BASE_URL}

                    rel='noreferrer'
                    title='Flaccid Sails home'
                >
                    <div className='header-logo'>
                        <img className='header-logo-image' src={Images.logo} alt='logo' />
                        <img className='header-logo-border' src={Images.logoBorder} alt='logo' />
                    </div>
                    <h1 className='header-title' style={{ textShadow }}>
                        Flaccid Sails
                    </h1>
                </a>
                <div className='header-tools'>
                    <HoverElement className='header-theme-trigger' side='DOWN' content={tooltip} hoverWithin>
                        <img className='header-theme-icon' src={Images.theme} alt='logo' />
                        <span className='header-theme-caption' style={{ textShadow }}>Theme</span>
                    </HoverElement>
                    {!requestFailed && (
                        <div className='header-guild-info'>
                            <span className='header-guild-name' style={{ textShadow }}>{'Demo roster'}</span>
                            <p className='header-guild-subtitle' style={{ textShadow }}>WoW Forever preview</p>
                        </div>
                    )}
                    <div className='header-time-info'>
                        <span className='header-time' style={{ textShadow }}>{time}</span>
                        <p className='header-time-caption' style={{ textShadow }}>Server Time</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
