import { useEffect, useRef, useState } from 'react';
import type { PlayerDTO } from '@src/models/PlayerDTO';
import type { EquipmentDTO } from '@src/models/EquipmentDTO';
import type { CharacterViewer } from '@src/vendor/tortoise/modelviewer';
import { modelEquipment, validCharacterAppearance } from './model-equipment';

export function CharacterModel({ player, equipment }: { player: PlayerDTO; equipment: EquipmentDTO[] }) {
    const stage = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState('Loading character model…');
    const [ready, setReady] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setReady(false);
        setFailed(false);
        if (!validCharacterAppearance(player.appearance)) {
            setStatus('Character appearance is unavailable.');
            return;
        }
        setStatus('Loading character model…');
        const appearance = player.appearance;
        const host = document.createElement('div');
        host.className = 'character-model-canvas';
        stage.current!.append(host);
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        let cancelled = false;
        let mounted: CharacterViewer | undefined;
        const reduceMotion = () => {
            if (motion.matches && mounted) {
                mounted.animate(false);
                mounted.spin(false);
            }
        };
        motion.addEventListener('change', reduceMotion);
        const { items, missing } = modelEquipment(equipment);
        void import('@src/vendor/tortoise/modelviewer.js').then(async ({ mountCharacterViewer }) => {
            if (cancelled) return;
            mounted = await mountCharacterViewer(host, {
                ...appearance, items, animate: !motion.matches, spin: false, cancelled: () => cancelled,
            });
            if (cancelled) { mounted.destroy(); return; }
            const state = mounted.state();
            setStatus(missing || state.missingGear || state.drawn.some(surface => !surface[3])
                ? 'Some equipped items could not be shown.' : '');
            setReady(true);
        }).catch(() => {
            if (cancelled) return;
            setStatus('Character model could not be loaded.');
            setFailed(true);
        });
        return () => {
            cancelled = true;
            motion.removeEventListener('change', reduceMotion);
            mounted?.destroy();
            host.remove();
        };
    }, [player, equipment, attempt]);

    return <><div className='character-model' aria-label={`${player.name} equipped character model`}>
        <div ref={stage} className='character-model-stage' role='img'
            aria-label={`3D preview of ${player.name}'s equipped gear`} aria-busy={!ready && !failed && validCharacterAppearance(player.appearance)} />
        {status && <p className='character-model-status' role='status'>{status}</p>}
        {failed && <div className='character-model-controls'>
            <button type='button' onClick={() => setAttempt(value => value + 1)}>Retry model</button>
        </div>}
    </div>
    <p className='character-model-credit'>Models: <a href='https://github.com/Xian55/tortoise-db-viewer'
        target='_blank' rel='noreferrer'>Tortoise DB</a> · © Blizzard</p></>;
}
