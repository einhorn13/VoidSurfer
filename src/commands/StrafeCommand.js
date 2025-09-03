// src/commands/StrafeCommand.js
import { ShipCommand } from './ShipCommand.js';

/**
 * A command to apply strafe thrust.
 */
export class StrafeCommand extends ShipCommand {
    /**
     * @param {number} direction -1 for left, 1 for right.
     */
    constructor(direction) {
        super();
        this.direction = direction;
    }

    execute(entityId, world, services) {
        const physics = world.getComponent(entityId, 'PhysicsComponent');
        if (physics) {
            physics.strafeDirection = this.direction;
        }
    }
}