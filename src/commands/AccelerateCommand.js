// src/commands/AccelerateCommand.js
import { ShipCommand } from './ShipCommand.js';

export class AccelerateCommand extends ShipCommand {
    constructor(isAccelerating) {
        super();
        this.isAccelerating = isAccelerating;
    }

    execute(entityId, world, services) {
        const physics = world.getComponent(entityId, 'PhysicsComponent');
        if (physics) {
            physics.isAccelerating = this.isAccelerating;
        }
    }
}