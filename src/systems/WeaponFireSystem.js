// src/systems/WeaponFireSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class WeaponFireSystem extends System {
    constructor(world) {
        super(world);
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.raycaster = new THREE.Raycaster();
        this.ray = new THREE.Ray();
        this.intersectionPoint = new THREE.Vector3();
        this.targetableEntityIds = [];
    }

    update(delta) {
        const fireEvents = this.world.getEvents('fire_weapon');
        if (fireEvents.length === 0) return;

        this.targetableEntityIds = [
            ...this.world.query(['ShipTag']),
            ...this.world.query(['AsteroidTag']),
            ...this.world.query(['StationComponent']) // <-- ADDED THIS
        ];

        for (const event of fireEvents) {
            const weaponData = event.hardpoint.weapon;

            if (weaponData.hitScan) {
                this._handleHitScanFire(event);
            } else {
                this._handleProjectileFire(event);
            }
        }
    }

    _handleProjectileFire(event) {
        const { originId, hardpoint, targetId } = event;
        const weaponType = hardpoint.weapon.type;

        if (weaponType === 'PROJECTILE') {
            this.entityFactory.projectile.createPlasmaBolt(originId, hardpoint);
        } else if (weaponType === 'HOMING') {
            this.entityFactory.missile.createMissile(originId, hardpoint, targetId);
        }
    }

    _handleHitScanFire(event) {
        const { originId, hardpoint } = event;
        const weapon = hardpoint.weapon;
        const originTransform = this.world.getComponent(originId, 'TransformComponent');
        if (!originTransform) return;

        const startPoint = this._getHardpointWorldPosition(originTransform, hardpoint);
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(originTransform.rotation);
        
        const hitResult = this._performRaycast(startPoint, direction, originId);

        let endPoint;
        if (hitResult) {
            endPoint = hitResult.point;
            const hitSource = {
                weaponData: weapon,
                originId: originId,
                faction: this.world.getComponent(originId, 'FactionComponent')?.name
            };
            this.world.publish('hit', {
                sourceData: hitSource,
                targetId: hitResult.entityId,
                impactPoint: endPoint
            });
        } else {
            endPoint = startPoint.clone().add(direction.multiplyScalar(1000));
        }
        
        this.entityFactory.effect.createLaserBeam(startPoint, endPoint, parseInt(weapon.color, 16));
    }

    _performRaycast(startPoint, direction, originId) {
        this.ray.set(startPoint, direction);
        let closestHit = null;

        for (const targetId of this.targetableEntityIds) {
            if (targetId === originId) continue;
            
            const health = this.world.getComponent(targetId, 'HealthComponent');
            if (health && health.isDestroyed) continue;
            
            const collision = this.world.getComponent(targetId, 'CollisionComponent');
            if (!collision) continue;

            if (this.ray.intersectSphere(collision.boundingSphere, this.intersectionPoint)) {
                const distance = startPoint.distanceTo(this.intersectionPoint);
                if (!closestHit || distance < closestHit.distance) {
                    closestHit = {
                        entityId: targetId,
                        point: this.intersectionPoint.clone(),
                        distance: distance
                    };
                }
            }
        }
        return closestHit;
    }

    _getHardpointWorldPosition(transform, hardpoint) {
        const offset = new THREE.Vector3().fromArray(hardpoint.pos || [0, 0, 0]);
        return offset.applyQuaternion(transform.rotation).add(transform.position);
    }
}