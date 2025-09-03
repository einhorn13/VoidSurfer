// src/systems/MovementSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

const tempVector = new THREE.Vector3();

export class MovementSystem extends System {
    constructor(world) {
        super(world);
        this.boostConfig = serviceLocator.get('DataManager').getConfig('game_balance').playerBoost;
    }

    update(delta) {
        const entities = this.world.query(['TransformComponent', 'PhysicsComponent']);

        for (const entityId of entities) {
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const physics = this.world.getComponent(entityId, 'PhysicsComponent');
            
            const stateComp = this.world.getComponent(entityId, 'StateComponent');
            const energy = this.world.getComponent(entityId, 'EnergyComponent');

            transform.prevPosition.copy(transform.position);

            if (physics.bodyType !== 'dynamic') {
                continue;
            }
            
            if (stateComp && stateComp.states.has('BOOSTING')) {
                if (energy && energy.current > 0) {
                    energy.current -= this.boostConfig.energyCostPerSecond * delta;
                    physics.isAccelerating = true;
                    physics.boostMultiplier = this.boostConfig.speedMultiplier;
                } else {
                    stateComp.states.delete('BOOSTING');
                    physics.boostMultiplier = 1.0;
                }
            } else if (physics.boostMultiplier !== 1.0) {
                physics.boostMultiplier = 1.0;
            }

            const isDrifting = stateComp && stateComp.states.has('DRIFT_ACTIVE');
            
            if (!isDrifting) {
                if (physics.acceleration > 0 && physics.isAccelerating) {
                    const forward = tempVector.set(0, 0, -1).applyQuaternion(transform.rotation);
                    const accelerationVector = forward.multiplyScalar(physics.acceleration * delta);
                    physics.velocity.add(accelerationVector);
                } else if (stateComp) {
                    const decelerationFactor = Math.max(0, 1.0 - (0.7 * delta));
                    physics.velocity.multiplyScalar(decelerationFactor);
                    if (physics.velocity.lengthSq() < 0.1) {
                        physics.velocity.set(0, 0, 0);
                    }
                }
            }

            const speedLimit = isDrifting ? physics.maxSpeed * 4.0 : physics.maxSpeed * physics.boostMultiplier;

            if (physics.maxSpeed > 0 && physics.velocity.lengthSq() > speedLimit * speedLimit) {
                physics.velocity.setLength(speedLimit);
            }

            if (stateComp && physics.strafeDirection !== 0 && !isDrifting) {
                const right = tempVector.set(1, 0, 0).applyQuaternion(transform.rotation);
                const strafeSpeed = physics.maxSpeed * 0.4;
                const strafeOffset = right.multiplyScalar(strafeSpeed * physics.strafeDirection * delta);
                transform.position.add(strafeOffset);
            }
            
            transform.position.add(tempVector.copy(physics.velocity).multiplyScalar(delta));

            transform.position.add(physics.correctionVector);
            physics.correctionVector.set(0, 0, 0);
        }
    }
}