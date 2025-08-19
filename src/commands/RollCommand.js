// src/commands/RollCommand.js
import * as THREE from 'three';
import { ShipCommand } from './ShipCommand.js';

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
        transform.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -turnAmount * this.direction));
    }
}