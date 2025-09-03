import { ShipCommand } from './ShipCommand.js';
import { serviceLocator } from '../ServiceLocator.js';

export class SelectWeaponCommand extends ShipCommand {
    /**
     * @param {number} index The hardpoint index to select.
     */
    constructor(index) {
        super();
        this.index = index;
    }

    execute(entityId, world, services) {
        const hardpoints = world.getComponent(entityId, 'HardpointComponent');
        const stateComp = world.getComponent(entityId, 'StateComponent');
        
        if (!hardpoints || this.index >= hardpoints.hardpoints.length || stateComp.states.has('GLOBAL_COOLDOWN')) {
            return;
        }

        hardpoints.selectedWeaponIndex = this.index;
        
        const gcdDuration = 0.2; // Shorter cooldown for direct selection
        stateComp.states.set('GLOBAL_COOLDOWN', { timeLeft: gcdDuration, duration: gcdDuration });
        
        const newWeaponName = hardpoints.hardpoints[this.index].weapon.name;
        serviceLocator.get('eventBus').emit('notification', { text: `Weapon selected: ${newWeaponName}`, type: 'info' });
    }
}