// src/commands/FireCommand.js
import { ShipCommand } from './ShipCommand.js';

export class FireCommand extends ShipCommand {
    execute(entityId, world, services) {
        const hardpoints = world.getComponent(entityId, 'HardpointComponent');
        if (!hardpoints) return;

        const currentHardpoint = hardpoints.hardpoints[hardpoints.selectedWeaponIndex];
        
        // Only publish a fire request if the weapon is not on its own cooldown.
        // This prevents event spam. GCD is checked later in WeaponFireSystem.
        if (currentHardpoint && currentHardpoint.cooldownLeft <= 0) {
            world.publish('fire_weapon_request', { 
                originId: entityId,
                hardpointIndex: hardpoints.selectedWeaponIndex
            });
        }
    }
}