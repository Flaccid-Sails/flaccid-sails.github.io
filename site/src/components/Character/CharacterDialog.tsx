import { EquipmentDTO } from '@src/models/EquipmentDTO';
import { PlayerDTO } from '@src/models/PlayerDTO';
import { StatisticsDTO } from '@src/models/StatisticsDTO';
import { EventEmitter } from '@src/utils/event-emitter';
import { readData } from '@src/utils/data';
import { useCallback, useEffect, useRef, useState } from 'react';
import { classPortrait, WindowFrame } from '../Frame/WindowFrame';
import { useDialogFade } from '../Frame/useDialogFade';
import { ScrollView } from '../ScrollView/ScrollView';
import { CharacterItem } from './CharacterItem';
import { CharacterStatistics } from './CharacterStatistics';
import { CloseButton } from '../Button/CloseButton';
import { characterAsset, EquipmentSlot, leftEquipmentSlots, rightEquipmentSlots, weaponEquipmentSlots } from './equipment-slots';
import './character.scss';

interface CharacterDetails { equipment: EquipmentDTO[]; statistics: StatisticsDTO }

export function CharacterDialog() {
    const [player, setPlayer] = useState<PlayerDTO>();
    const [details, setDetails] = useState<CharacterDetails>();
    const [failed, setFailed] = useState(false);
    const windowRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef(0);
    const { isClosing, cancelClose, fadeOut } = useDialogFade();
    const isOpen = Boolean(player) && !isClosing;
    const close = useCallback(() => {
        requestRef.current++;
        EventEmitter.emit('CLOSE_POPUPS');
        fadeOut(() => {
            setPlayer(undefined);
            setDetails(undefined);
        });
    }, [fadeOut]);

    useEffect(() => {
        const unsubscribe = EventEmitter.subscribe('OPEN_CHARACTER_DIALOG', character => {
            const request = ++requestRef.current;
            EventEmitter.emit('CLOSE_POPUPS');
            cancelClose();
            setPlayer(character);
            setDetails(undefined);
            setFailed(false);
            void Promise.all([
                readData<EquipmentDTO[]>(`/equipment/${character.realm}/${character.name}`),
                readData<StatisticsDTO>(`/statistics/${character.realm}/${character.name}`),
            ]).then(([equipment, statistics]) => {
                if (request !== requestRef.current) return;
                if (!equipment || !statistics) throw new Error('Missing character details');
                setDetails({ equipment, statistics });
            }).catch(() => {
                if (request === requestRef.current) setFailed(true);
            });
        });
        return () => { requestRef.current++; unsubscribe(); };
    }, [cancelClose]);

    useEffect(() => {
        if (!isOpen) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const frame = windowRef.current!;
        frame.querySelector<HTMLButtonElement>('.wow-window-close')?.focus({ preventScroll: true });
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { close(); event.preventDefault(); }
            if (event.key !== 'Tab') return;
            const controls = Array.from(frame.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
            else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus({ preventScroll: true }); };
    }, [isOpen, close]);

    if (!player) return null;
    const classSlug = player.class.toLowerCase().replaceAll(' ', '-');
    const portrait = classPortrait(player.class);
    const renderSlot = (slot: EquipmentSlot, side: 'LEFT' | 'RIGHT' | 'UP') => {
        const item = details?.equipment.find(item => item.slot === slot.key || slot.aliases?.includes(item.slot));
        return <CharacterItem key={slot.key} item={item} slot={slot} side={side} />;
    };

    return <div className={`character-overlay dialog-fade${isClosing ? ' dialog-fade-out' : ''}`} aria-hidden={isClosing}>
        <div className='character-backdrop' onClick={close} />
        <div ref={windowRef} className='character-window' role='dialog' aria-modal='true' aria-labelledby='character-heading'>
            <WindowFrame portrait={portrait} />
            <h1 id='character-heading' className='wow-window-title'>{player.name}</h1>
            <CloseButton className='wow-window-close' onClick={close} aria-label='Close character details' />
            <div className='character-viewport' tabIndex={0} aria-label='Equipment and character statistics'
                onScroll={() => EventEmitter.emit('CLOSE_POPUPS')}>
                <div className='character-layout' aria-busy={!details && !failed}>
                    <section className='character-paperdoll' aria-label='Equipped items'>
                        <div className='character-equipment-column character-equipment-left'>
                            {leftEquipmentSlots.map(slot => renderSlot(slot, 'RIGHT'))}
                        </div>
                        <div className='character-equipment-column character-equipment-right'>
                            {rightEquipmentSlots.map(slot => renderSlot(slot, 'LEFT'))}
                        </div>
                        <div className='character-weapons'>
                            {weaponEquipmentSlots(player.class).map(slot => renderSlot(slot, 'UP'))}
                        </div>
                    </section>
                    <section className='character-sidebar' aria-label='Character statistics'>
                        <header className='character-sidebar-header'>
                            <div className='character-stat-portrait' aria-hidden='true'>
                                <img src={player.image || portrait} alt='' />
                                <img className='character-stat-portrait-frame' src={characterAsset('character-details/ui-character-info-stattab-selected-c60-2x.webp')} alt='' />
                            </div>
                            <p>Level {player.level} <span style={{ color: `var(--${classSlug}-color)` }}>{player.class}</span></p>
                        </header>
                        <div className='character-stats-panel'
                            style={{ backgroundImage: `url(${characterAsset(`backgrounds/ui-character-info-${classSlug}-bg-c60-2x.webp`)})` }}>
                            <ScrollView className='character-stat-scroll' proportionalThumb>
                                {details
                                    ? <CharacterStatistics player={player} statistics={details.statistics} />
                                    : <p className='character-status' role='status'>{failed ? 'Character details are unavailable.' : 'Loading character details…'}</p>}
                            </ScrollView>
                            <div className='character-stats-border' aria-hidden='true' />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </div>;
}
