import { EquipmentDTO } from '@src/models/EquipmentDTO';
import { Images } from '@src/utils/images';
import { CSSProperties } from 'react';
import { HoverElement } from '../Popups/HoverElement';
import { characterAsset, EquipmentSlot } from './equipment-slots';

function CharacterItemTooltip({ item, label }: { item: EquipmentDTO; label: string }) {
    return <div className='character-item-tooltip'>
        <p className='character-item-name' style={{ color: `var(--quality-${item.quality.toLowerCase()}-color)` }}>
            {item.id > 0
                ? <a href={`https://www.wowhead.com/classic/item=${item.id}`} target='_blank' rel='noreferrer'>{item.name}</a>
                : item.name}
        </p>
        <p className='item-level'>Item Level {item.itemLevel}</p>
        {item.transmog && <p className='item-transmog'>{item.transmog}</p>}
        <div className='character-item-type'><span>{label}</span><span>{item.itemSubclass !== 'Miscellaneous' ? item.itemSubclass : item.inventoryType}</span></div>
        {Boolean(item.armor) && <p>{item.armor} Armor</p>}
        {item.stats.map(stat => <p key={stat}>{stat}</p>)}
        {item.bonusStats.map(stat => <p key={stat} className='item-attribute'>+{stat}</p>)}
        {item.enchant && <p className='item-attribute'>{item.enchant}</p>}
        {item.sockets.map(socket => <div key={socket.id} className='character-item-socket'>
            <img src={socket.media || Images.wowIcon} alt='' /><span>{socket.display}</span>
        </div>)}
        {item.socketBonus && <p className='item-attribute'>Socket Bonus: {item.socketBonus}</p>}
        {item.requirements.map(requirement => <p key={requirement}>{requirement}</p>)}
        {item.spells.map(spell => <p key={spell} className='item-attribute'>{spell}</p>)}
    </div>;
}

interface Props {
    item?: EquipmentDTO;
    slot: EquipmentSlot;
    side: 'LEFT' | 'UP' | 'RIGHT';
}

export function CharacterItem({ item, slot, side }: Props) {
    const icon = <div className={`character-equipment-frame ${item ? '' : 'character-equipment-empty'}`}
        data-equipment-slot={slot.key} role='img' aria-label={`${slot.label}: ${item?.name ?? 'Empty'}`}
        style={{ '--item-quality': `var(--quality-${item?.quality.toLowerCase() ?? 'common'}-color, #fff)` } as CSSProperties}>
        {item && <span className='character-equipment-quality' aria-hidden='true' />}
        <img className='character-equipment-icon'
            src={item ? item.media || Images.wowIcon : characterAsset(`empty-slots/ui-paperdoll-slot-${slot.emptyIcon}.webp`)} alt='' />
    </div>;

    return <div className={`character-equipment-slot character-equipment-info-${side.toLowerCase()}`}>
        {item ? <HoverElement className='character-equipment-hover' side={side} hoverWithin
            content={() => <CharacterItemTooltip item={item} label={slot.label} />}>{icon}</HoverElement> : icon}
        {item && <div className='character-equipment-info'>
            <div className='character-equipment-info-line'>
                {item.itemLevel > 1 && <span className='character-equipment-level' aria-label={`Item level ${item.itemLevel}`}
                    style={{ color: `var(--quality-${item.quality.toLowerCase()}-color)` }}>{item.itemLevel}</span>}
                {item.sockets.map((socket, index) => <img key={index} className='character-equipment-gem'
                    src={socket.media || Images.wowIcon} alt={socket.display} title={socket.display} />)}
            </div>
            {item.enchant && <p className='character-equipment-enchant'>{item.enchant}</p>}
        </div>}
    </div>;
}
