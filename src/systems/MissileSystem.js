import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

function isVector3NaN(v) {
    return isNaN(v.x) || isNaN(v.y) || isNaN(v.z);
}

export class MissileSystem extends System {
    constructor(world) {
        super(world);
        this.eventBus = serviceLocator.get('eventBus');
        this.scanner = serviceLocator.get('Scanner');
    }

    update(delta) {
        const homingEntities = this.world.query(['HomingComponent', 'PhysicsComponent', 'TransformComponent', 'HealthComponent']);
        for (const entityId of homingEntities) {
            const health = this.world.getComponent(entityId, 'HealthComponent');
            if (health.state !== 'ALIVE') continue;

            const homing = this.world.getComponent(entityId, 'HomingComponent');
            const physics = this.world.getComponent(entityId, 'PhysicsComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            
            if (isVector3NaN(physics.velocity)) {
                console.error(`NaN detected in velocity for missile ${entityId}. Destroying missile.`);
                health.state = 'DESTROYED';
                continue;
            }

            let targetTransform = this.world.getComponent(homing.targetId, 'TransformComponent');
            const targetHealth = this.world.getComponent(homing.targetId, 'HealthComponent');

            if (!targetTransform || !targetHealth || targetHealth.state !== 'ALIVE') {
                const newTargetId = this.scanner.findBestTargetInRadius(entityId, 400);
                if (newTargetId) {
                    homing.targetId = newTargetId;
                    targetTransform = this.world.getComponent(homing.targetId, 'TransformComponent');
                } else {
                    homing.targetId = null;
                }
            }

            if (!homing.targetId || !targetTransform) continue;

            const directionToTarget = new THREE.Vector3().subVectors(targetTransform.position, transform.position);

            if (directionToTarget.lengthSq() < 0.0001) {
                continue;
            }
            directionToTarget.normalize();
            
            const desiredVelocity = directionToTarget.clone().multiplyScalar(homing.maxSpeed);
            physics.velocity.lerp(desiredVelocity, homing.turnRate * delta);

            const isPlayerTarget = !!this.world.getComponent(homing.targetId, 'PlayerControlledComponent');
            if (isPlayerTarget && !homing.notificationSent) {
                this.eventBus.emit('notification', { text: 'Incoming missile!', type: 'warning' });
                homing.notificationSent = true;
            }
            
            if (physics.velocity.lengthSq() > 0.01) {
                const lookAtQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), physics.velocity.clone().normalize());
                transform.rotation.slerp(lookAtQuaternion, delta * 10.0);
            }
        }
    }
}