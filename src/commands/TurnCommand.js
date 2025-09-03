import * as THREE from 'three';
import { ShipCommand } from './ShipCommand.js';

const MOUSE_DEAD_ZONE = 0.05;
const MOUSE_MAX_RANGE = 0.3;
const MOUSE_SENSITIVITY = 1.0;

export class TurnCommand extends ShipCommand {
    /**
     * @param {string} type 'pitch' or 'yaw'.
     * @param {number} direction -1 or 1 for keyboard, ignored for mouse.
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

        if (this.isMouseControlled) {
            this._executeMouseTurn(transform, services.delta);
        } else {
            this._executeKeyboardTurn(transform, physics, services.delta);
        }
    }

    _executeMouseTurn(transform, delta) {
        const mouseTurnSpeed = MOUSE_SENSITIVITY * delta;

        // Yaw (left/right) based on horizontal mouse position
        if (this.type === 'yaw' && Math.abs(this.mouseState.x) > MOUSE_DEAD_ZONE) {
            // Calculate how far the mouse is outside the dead zone, normalized to the max range.
            const relativeX = Math.abs(this.mouseState.x) - MOUSE_DEAD_ZONE;
            const strength = Math.min(relativeX / MOUSE_MAX_RANGE, 1.0);
            
            const amount = mouseTurnSpeed * -Math.sign(this.mouseState.x) * strength;
            transform.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), amount));
        } 
        // Pitch (up/down) based on vertical mouse position
        else if (this.type === 'pitch' && Math.abs(this.mouseState.y) > MOUSE_DEAD_ZONE) {
            const relativeY = Math.abs(this.mouseState.y) - MOUSE_DEAD_ZONE;
            const strength = Math.min(relativeY / MOUSE_MAX_RANGE, 1.0);

            const amount = mouseTurnSpeed * Math.sign(this.mouseState.y) * strength;
            transform.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), amount));
        }
    }

    _executeKeyboardTurn(transform, physics, delta) {
        const turnAmount = physics.turnSpeed * delta * this.direction;
        const axis = this.type === 'pitch' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        transform.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(axis, turnAmount));
    }
}