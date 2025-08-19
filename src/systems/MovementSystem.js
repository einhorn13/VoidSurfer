// src/systems/MovementSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';

export class MovementSystem extends System {
    update(delta) {
        const entities = this.world.query(['TransformComponent', 'PhysicsComponent']);

        for (const entityId of entities) {
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const physics = this.world.getComponent(entityId, 'PhysicsComponent');

            // Store previous position for CCD
            transform.prevPosition.copy(transform.position);

            if (physics.bodyType !== 'dynamic') {
                continue;
            }

            if (physics.acceleration > 0 && physics.isAccelerating) {
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.rotation);
                const accelerationVector = forward.clone().multiplyScalar(physics.acceleration * delta);
                physics.velocity.add(accelerationVector);
            } else {
                // Apply deceleration/friction only to ships that are not accelerating
                const isShip = this.world.getComponent(entityId, 'ShipTag');
                if (isShip) {
                    const decelerationFactor = 1.0 - (0.7 * delta);
                    physics.velocity.multiplyScalar(decelerationFactor);
                    if (physics.velocity.lengthSq() < 0.1) {
                        physics.velocity.set(0, 0, 0);
                    }
                }
            }

            const currentMaxSpeed = physics.maxSpeed * physics.boostMultiplier;
            if (physics.maxSpeed > 0 && physics.velocity.lengthSq() > currentMaxSpeed * currentMaxSpeed) {
                physics.velocity.setLength(currentMaxSpeed);
            }

            transform.position.add(physics.velocity.clone().multiplyScalar(delta));
        }
    }
}