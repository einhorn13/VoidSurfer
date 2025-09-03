import * as THREE from 'three';
import { ShipCommand } from './ShipCommand.js';

// Optimization: Define constant axis to avoid reallocation.
const ROLL_AXIS = new THREE.Vector3(0, 0, 1);

export class RollCommand extends ShipCommand {
    /**
     * @param {number} direction -1 for left, 1 for right.
     */
    constructor(direction) {
        super();
        this.direction = direction;
    }

    execute(entityId, world, services) {
        const transform = world.getComponent(entityId, 'TransformComponent');
        const physics = world.getComponent(entityId, 'PhysicsComponent');
        if (!transform || !physics) return;

        const turnAmount = physics.turnSpeed * services.delta;
        
        // Use a pre-allocated quaternion to avoid creating new objects in the loop.
        const deltaRotation = new THREE.Quaternion().setFromAxisAngle(ROLL_AXIS, -turnAmount * this.direction);
        transform.rotation.multiply(deltaRotation);
    }
}