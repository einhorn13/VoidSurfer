// src/commands/TurnCommand.js
import * as THREE from 'three';
import { ShipCommand } from './ShipCommand.js';

const MOUSE_DEAD_ZONE = 0.05;
const MOUSE_MAX_RANGE = 0.3;
const MOUSE_SENSITIVITY = 1.0;

export class TurnCommand extends ShipCommand {
    /**
     * @param {string} type 'pitch' or 'yaw'.
     * @param {number} direction -1 or 1.
     * @param {boolean} isMouseControlled Is this command coming from the mouse?
     * @param {object} mouseState The current state of the mouse {x, y}.
     */
    constructor(type, direction, isMouseControlled = false, mouseState = null) {
        super();
        this.type = type;
        this.direction = direction;
        this.isMouseControlled = isMouseControlled;
        this.mouseState = mouseState;
    }

    execute(entityId, world, services) {
        const transform = world.getComponent(entityId, 'TransformComponent');
        const physics = world.getComponent(entityId, 'PhysicsComponent');
        if (!transform || !physics) return;

        const delta = services.delta;
        
        if (this.isMouseControlled) {
            const mouseTurnSpeed = MOUSE_SENSITIVITY * delta;
            if (this.type === 'yaw' && Math.abs(this.mouseState.x) > MOUSE_DEAD_ZONE) {
                const relativeX = Math.abs(this.mouseState.x) - MOUSE_DEAD_ZONE;
                const strength = Math.min(relativeX / MOUSE_MAX_RANGE, 1.0);
                const amount = mouseTurnSpeed * -Math.sign(this.mouseState.x) * strength;
                transform.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), amount));
            } else if (this.type === 'pitch' && Math.abs(this.mouseState.y) > MOUSE_DEAD_ZONE) {
                const relativeY = Math.abs(this.mouseState.y) - MOUSE_DEAD_ZONE;
                const strength = Math.min(relativeY / MOUSE_MAX_RANGE, 1.0);
                const amount = mouseTurnSpeed * Math.sign(this.mouseState.y) * strength;
                transform.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), amount));
            }
        } else {
            const turnAmount = physics.turnSpeed * delta * this.direction;
            const axis = this.type === 'pitch' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
            transform.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(axis, turnAmount));
        }
    }
}