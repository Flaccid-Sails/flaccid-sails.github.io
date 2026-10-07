import { CSSProperties, MouseEventHandler, PropsWithChildren } from 'react';
import './button.scss';

interface Props extends PropsWithChildren {
    className?: string;
    contentClassName?: string;
    style?: CSSProperties;
    selected?: boolean;
    disabled?: boolean;
    onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function Button({
    style,
    className,
    contentClassName,
    selected,
    disabled,
    children,
    onClick,
}: Props): React.ReactNode {
    return (
        <button type='button' style={style} aria-pressed={selected} disabled={disabled}
            className={['button', 'forever-button', selected && 'is-selected', className].filter(Boolean).join(' ')}
            onClick={onClick}
        >
            <span className={['forever-button-content', contentClassName].filter(Boolean).join(' ')}>
                {children}
            </span>
        </button>
    );
}
