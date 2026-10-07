import { Theme } from '@src/models/Theme';
import { themeToImage } from '@src/utils/helpers';
import { Images } from '@src/utils/images';
import { CSSProperties, PropsWithChildren, useMemo } from 'react';
import './frame.scss';

interface Props extends PropsWithChildren {
    theme: Theme;
    className?: string;
    style?: CSSProperties;
    contentClassName?: string;
    contentStyle?: CSSProperties;
}

export function Frame({ theme, children, className, style, contentClassName, contentStyle }: Props): React.ReactNode {
    const image = useMemo(() => themeToImage(theme), [theme]);

    const verticalImage = useMemo(() => {
        switch (theme) {
            case 'ALLIANCE':
                return Images.themeAllianceVertical;
            case 'HORDE':
                return Images.themeHordeVertical;
            case 'KYRIAN':
                return Images.themeKyrianVertical;
            case 'MARINE':
                return Images.themeMarineVertical;
            case 'MECHAGON':
                return Images.themeMechagonVertical;
            case 'NECROLORD':
                return Images.themeNecrolordVertical;
            case 'NEUTRAL':
                return Images.themeNeutralVertical;
            case 'NIGHT_FAE':
                return Images.themeNightFaeVertical;
            case 'VENTHYR':
                return Images.themeVenthyrVertical;
            case 'ORIBOS':
                return Images.themeOribosVertical;
        }
    }, [theme]);

    const leftStyle = useMemo((): CSSProperties => ({
        backgroundImage: `url(${verticalImage})`,
        backgroundPositionX: -3,
        backgroundSize: '280%',
        filter: 'drop-shadow(1px 0 1px rgba(0,0,0,0.7))'
    }), [verticalImage]);

    const rightStyle = useMemo((): CSSProperties => ({
        backgroundImage: `url(${verticalImage})`,
        backgroundPositionX: 18,
        backgroundSize: '280%',
        filter: 'drop-shadow(-1px 0 1px rgba(0,0,0,0.7))'
    }), [verticalImage]);

    const topStyle = useMemo((): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${image})`,
            backgroundSize: 665,
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))',
        };

        switch (theme) {
            case 'ALLIANCE':
                return { ...fixedStyle, backgroundPositionY: -23.5 };
            case 'HORDE':
                return { ...fixedStyle, backgroundPositionY: -80.5 };
            case 'KYRIAN':
                return { ...fixedStyle, backgroundPositionY: -80.5 };
            case 'MARINE':
                return { ...fixedStyle, backgroundPositionY: -23.5 };
            case 'MECHAGON':
                return { ...fixedStyle, backgroundPositionY: -80.5 };
            case 'NECROLORD':
                return { ...fixedStyle, backgroundPositionY: -59 };
            case 'NEUTRAL':
                return { ...fixedStyle, backgroundPositionY: -3 };
            case 'NIGHT_FAE':
                return { ...fixedStyle, backgroundPositionY: -22.6 };
            case 'VENTHYR':
                return { ...fixedStyle, backgroundPositionY: -3 };
            case 'ORIBOS':
                return { ...fixedStyle, backgroundPositionY: -80.8, backgroundSize: 168 };
        }
    }, [theme, image]);

    const bottomStyle = useMemo((): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${image})`,
            backgroundSize: 665,
            filter: 'drop-shadow(0 -1px 1px rgba(0,0,0,0.7))',
        };

        switch (theme) {
            case 'ALLIANCE':
                return { ...fixedStyle, backgroundPositionY: -3 };
            case 'HORDE':
                return { ...fixedStyle, backgroundPositionY: -59 };
            case 'KYRIAN':
                return { ...fixedStyle, backgroundPositionY: -3 };
            case 'MARINE':
                return { ...fixedStyle, backgroundPositionY: -3 };
            case 'MECHAGON':
                return { ...fixedStyle, backgroundPositionY: -3 };
            case 'NECROLORD':
                return { ...fixedStyle, backgroundPositionY: -80.5 };
            case 'NEUTRAL':
                return { ...fixedStyle, backgroundPositionY: -80.5 };
            case 'NIGHT_FAE':
                return { ...fixedStyle, backgroundPositionY: -3 };
            case 'VENTHYR':
                return { ...fixedStyle, backgroundPositionY: -22.6 };
            case 'ORIBOS':
                return { ...fixedStyle, backgroundPositionY: -59.8, backgroundSize: 168 };
        }
    }, [theme, image]);

    const tlStyle = useMemo((): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${image})`,
            backgroundSize: 665,
            width: 106,
            height: 106
        };

        switch (theme) {
            case 'ALLIANCE':
                return { ...fixedStyle, backgroundPositionY: -387.2, backgroundPositionX: -3 };
            case 'HORDE':
                return { ...fixedStyle, backgroundPositionY: -523.4, backgroundPositionX: -3 };
            case 'KYRIAN':
                return { ...fixedStyle, backgroundPositionY: -101.3, backgroundPositionX: -2.8 };
            case 'MARINE':
                return { ...fixedStyle, backgroundPositionY: -496.3, backgroundPositionX: -2.8 };
            case 'MECHAGON':
                return { ...fixedStyle, backgroundPositionY: -101.3, backgroundPositionX: -2.8 };
            case 'NECROLORD':
                return { ...fixedStyle, backgroundPositionY: -386.8, backgroundPositionX: -2.8 };
            case 'NEUTRAL':
                return { ...fixedStyle, backgroundPositionY: -481.6, backgroundPositionX: -3 };
            case 'NIGHT_FAE':
                return { ...fixedStyle, backgroundPositionY: -390, backgroundPositionX: -3, height: 103 };
            case 'VENTHYR':
                return { ...fixedStyle, backgroundPositionY: -338.8, backgroundPositionX: -3 };
            case 'ORIBOS':
                return { ...fixedStyle, backgroundPositionY: -322.4, backgroundPositionX: -3, backgroundSize: 168 };
        }
    }, [theme, image]);

    const trStyle = useMemo((): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${image})`,
            backgroundSize: 665,
            width: 106,
            height: 106
        };

        switch (theme) {
            case 'ALLIANCE':
                return { ...fixedStyle, backgroundPositionY: -387.4, backgroundPositionX: -2.8, transform: 'rotate(90deg)' };
            case 'HORDE':
                return { ...fixedStyle, backgroundPositionY: -523.4, backgroundPositionX: -2.8, transform: 'scaleX(-1)' };
            case 'KYRIAN':
                return { ...fixedStyle, backgroundPositionY: -428.6, backgroundPositionX: -0.2 };
            case 'MARINE':
                return { ...fixedStyle, backgroundPositionY: -387.3 };
            case 'MECHAGON':
                return { ...fixedStyle, backgroundPositionY: -428.6 };
            case 'NECROLORD':
                return { ...fixedStyle, backgroundPositionY: -100.4, backgroundPositionX: -502.2 };
            case 'NEUTRAL':
                return { ...fixedStyle, backgroundPositionY: -481.6, backgroundPositionX: -3, transform: 'rotate(90deg)' };
            case 'NIGHT_FAE':
                return { ...fixedStyle, backgroundPositionY: -389, backgroundPositionX: -421 };
            case 'VENTHYR':
                return { ...fixedStyle, backgroundPositionY: -557, backgroundPositionX: -0.3 };
            case 'ORIBOS':
                return { ...fixedStyle, backgroundPositionY: -432.6, backgroundPositionX: -1.3, backgroundSize: 168 };
        }
    }, [theme, image]);

    const blStyle = useMemo((): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${image})`,
            backgroundSize: 665,
            width: 106,
            height: 106
        };

        switch (theme) {
            case 'ALLIANCE':
                return { ...fixedStyle, backgroundPositionY: -387.4, backgroundPositionX: -2.8, transform: 'rotate(-90deg)' };
            case 'HORDE':
                return { ...fixedStyle, backgroundPositionY: -523.6, backgroundPositionX: -3, transform: 'rotate(180deg) scaleX(-1)' };
            case 'KYRIAN':
                return { ...fixedStyle, backgroundPositionY: -207.4, backgroundPositionX: -2.9 };
            case 'MARINE':
                return { ...fixedStyle, backgroundPositionY: -98.4, backgroundPositionX: -532.8 };
            case 'MECHAGON':
                return { ...fixedStyle, backgroundPositionY: -206.4, backgroundPositionX: -2.9 };
            case 'NECROLORD':
                return { ...fixedStyle, backgroundPositionY: -384.6, backgroundPositionX: -423.8 };
            case 'NEUTRAL':
                return { ...fixedStyle, backgroundPositionY: -481.6, backgroundPositionX: -3, transform: 'rotate(-90deg)' };
            case 'NIGHT_FAE':
                return { ...fixedStyle, backgroundPositionY: -94.6, backgroundPositionX: -505 };
            case 'VENTHYR':
                return { ...fixedStyle, backgroundPositionY: -225.9, backgroundPositionX: -3 };
            case 'ORIBOS':
                return { ...fixedStyle, backgroundPositionY: -100, backgroundPositionX: -3, backgroundSize: 168 };
        }
    }, [theme, image]);

    const brStyle = useMemo((): CSSProperties => {
        const fixedStyle: CSSProperties = {
            backgroundImage: `url(${image})`,
            backgroundSize: 665,
            width: 106,
            height: 106
        };

        switch (theme) {
            case 'ALLIANCE':
                return { ...fixedStyle, backgroundPositionY: -387.2, backgroundPositionX: -3, transform: 'rotate(180deg)' };
            case 'HORDE':
                return { ...fixedStyle, backgroundPositionY: -523.4, backgroundPositionX: -3, transform: 'rotate(180deg)' };
            case 'KYRIAN':
                return { ...fixedStyle, backgroundPositionY: -316.6, backgroundPositionX: -0.3 };
            case 'MARINE':
                return { ...fixedStyle, backgroundPositionY: -98.4, backgroundPositionX: -421.2 };
            case 'MECHAGON':
                return { ...fixedStyle, backgroundPositionY: -315.4, backgroundPositionX: 1 };
            case 'NECROLORD':
                return { ...fixedStyle, backgroundPositionY: -494.5 };
            case 'NEUTRAL':
                return { ...fixedStyle, backgroundPositionY: -481.6, backgroundPositionX: -3, transform: 'rotate(180deg)' };
            case 'NIGHT_FAE':
                return { ...fixedStyle, backgroundPositionY: -494, height: 103 };
            case 'VENTHYR':
                return { ...fixedStyle, backgroundPositionY: -445, backgroundPositionX: -0.3, height: 105 };
            case 'ORIBOS':
                return { ...fixedStyle, backgroundPositionY: -210.4, backgroundPositionX: -1.3, backgroundSize: 168 };
        }
    }, [theme, image]);

    return (
        <div className={['frame', className].filter(Boolean).join(' ')}
            style={{ ...(style ?? {}), '--size': '15px' } as any}
        >
            <div className={['frame-content', contentClassName].filter(Boolean).join(' ')} style={contentStyle}>
                {children}
            </div>

            <div className='frame-left' style={leftStyle} />
            <div className='frame-right' style={rightStyle} />
            <div className='frame-top' style={topStyle} />
            <div className='frame-bottom' style={bottomStyle} />

            <div className='frame-corner-top-left' style={tlStyle} />
            <div className='frame-corner-top-right' style={trStyle} />

            <div className='frame-corner-bottom-left' style={blStyle} />
            <div className='frame-corner-bottom-right' style={brStyle} />
        </div>
    );
}