// src/systems/MissileSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class MissileSystem extends System {
    constructor(world) {
        super(world);
        this.eventBus = serviceLocator.get('eventBus');
        this.spatialGrid = serviceLocator.get('WorldManager').spatialGrid;
        this.queryBox = new THREE.Box3();
    }

    update(delta) {
        const homingEntities = this.world.query(['HomingComponent', 'PhysicsComponent', 'TransformComponent', 'HealthComponent']);
        for (const entityId of homingEntities) {
            const health = this.world.getComponent(entityId, 'HealthComponent');
            if (health.isDestroyed) continue;

            const homing = this.world.getComponent(entityId, 'HomingComponent');
            const physics = this.world.getComponent(entityId, 'PhysicsComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            
            let targetTransform = this.world.getComponent(homing.targetId, 'TransformComponent');
            const targetHealth = this.world.getComponent(homing.targetId, 'HealthComponent');

            if (!targetTransform || !targetHealth || targetHealth.isDestroyed) {
                homing.targetId = this.findNewTarget(entityId);
                if (homing.targetId === null) continue; // No new target found, continue straight
                targetTransform = this.world.getComponent(homing.targetId, 'TransformComponent');
            }

            const directionToTarget = new THREE.Vector3().subVectors(targetTransform.position, transform.position).normalize();
            
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

    findNewTarget(missileId) {
        const missile = this.world.getComponent(missileId, 'MissileComponent');
        const transform = this.world.getComponent(missileId, 'TransformComponent');
        if (!missile || !transform) return null;

        let closestTargetId = null;
        let minDistanceSq = 400 * 400; // Search within a 400m radius

        const size = new THREE.Vector3(1, 1, 1).multiplyScalar(800);
        this.queryBox.setFromCenterAndSize(transform.position, size);
        const nearby = this.spatialGrid.getNearby({ boundingBox: this.queryBox });

        for (const other of nearby) {
            const targetId = other.entityId;
            if (targetId === missileId || targetId === missile.originId) continue;
            
            const targetHealth = this.world.getComponent(targetId, 'HealthComponent');
            if (!targetHealth || targetHealth.isDestroyed) continue;
            
            const targetFaction = this.world.getComponent(targetId, 'FactionComponent');
            if (!targetFaction || targetFaction.name === missile.faction) continue;

            const targetTransform = this.world.getComponent(targetId, 'TransformComponent');
            const distanceSq = transform.position.distanceToSquared(targetTransform.position);

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestTargetId = targetId;
            }
        }
        return closestTargetId;
    }
}