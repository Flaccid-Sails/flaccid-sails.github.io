import { Images } from '@src/utils/images';
import { CSSProperties, FormEventHandler, useEffect, useState } from 'react';

interface Props {
    style?: CSSProperties;
    className?: string;
    placeholder?: string;
    text?: string;
    maxLength?: number;
    onInput?: FormEventHandler<HTMLInputElement>;
}

export function TextInput({ style, maxLength, className, placeholder, text, onInput }: Props): React.ReactNode {
    const [inputText, setInputText] = useState(text ?? '');

    useEffect(() => {
        setInputText(text ?? '');
    }, [text]);

    const onInputHandler: FormEventHandler<HTMLInputElement> = (e) => {
        const newText = e.currentTarget.value;
        if (maxLength && newText.length > maxLength) {
            return;
        }
        setInputText(newText);
        onInput?.(e);
    };

    return (
        <input style={{ ...(style ?? {}), backgroundImage: `url(${Images.searchBorder})` }}
            className={[className, 'text-input'].filter(Boolean).join(' ')}
            type='text'
            placeholder={placeholder}
            value={inputText}
            onInput={onInputHandler}
            maxLength={maxLength ?? 16} />
    );
}
