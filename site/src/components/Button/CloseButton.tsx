import { ButtonHTMLAttributes } from 'react';
import './close-button.scss';

export function CloseButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button type='button' aria-label='Close' {...props}
        className={['wow-close-button', className].filter(Boolean).join(' ')} />;
}
