// src/systems/HitResolverSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class HitResolverSystem extends System {
    constructor(world) {
        super(world);
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.spatialGrid = serviceLocator.get('WorldManager').spatialGrid;
        this.aoeQueryBox = new THREE.Box3();
        this.balanceConfig = serviceLocator.get('DataManager').getConfig('game_balance').collisionPhysics;
    }

    update(delta) {
        const hitEvents = this.world.getEvents('hit');
        for (const event of hitEvents) {
            this._resolveHit(event);
        }
    }

    _resolveHit(hitEvent) {
        const { sourceId, sourceData, targetId, impactPoint } = hitEvent;

        if (sourceData && sourceData.type === 'collision') {
            this._resolvePhysicalCollision(sourceData, targetId, impactPoint);
            return;
        }
        
        let sourceWeaponData, sourceFaction, sourceOriginId;
        
        if (sourceData) {
            sourceWeaponData = sourceData.weaponData;
            sourceFaction = sourceData.faction;
            sourceOriginId = sourceData.originId;
        } else {
            const sourceProjectile = this.world.getComponent(sourceId, 'ProjectileComponent');
            const sourceMissile = this.world.getComponent(sourceId, 'MissileComponent');

            if (sourceProjectile) {
                sourceWeaponData = sourceProjectile.weaponData;
                sourceFaction = sourceProjectile.faction;
                sourceOriginId = sourceProjectile.originId;
            } else if (sourceMissile) {
                sourceWeaponData = sourceMissile.weaponData;
                sourceFaction = sourceMissile.faction;
                sourceOriginId = sourceMissile.originId;
            } else {
                return;
            }
        }

        const targetHealth = this.world.getComponent(targetId, 'HealthComponent');
        if (!targetHealth || targetHealth.isDestroyed) return;
        if (targetId === sourceOriginId) return;
        
        const targetFactionComp = this.world.getComponent(targetId, 'FactionComponent');
        if (!sourceFaction) return;
        if (targetFactionComp && targetFactionComp.name === sourceFaction) return;
        
        const targetTransform = this.world.getComponent(targetId, 'TransformComponent');
        if (!targetTransform) return;

        const impactNormal = new THREE.Vector3().subVectors(impactPoint, targetTransform.position).normalize();

        this.world.publish('damage', {
            targetId: targetId,
            amount: sourceWeaponData.damage,
            impactPoint: impactPoint,
            impactNormal: impactNormal,
            attackerId: sourceOriginId // Pass the attacker's ID
        });
        
        if (sourceWeaponData.explosionRadius > 0) {
            this._applyAoeDamage(impactPoint, sourceWeaponData, sourceFaction, sourceOriginId);
        }
        
        if (sourceId) {
            const sourceProjectile = this.world.getComponent(sourceId, 'ProjectileComponent');
            if (sourceProjectile) {
                 sourceProjectile.pierceLeft -= 1;
                if (sourceProjectile.pierceLeft < 0) this._destroyProjectile(sourceId, impactPoint);
            } else {
                 this._destroyProjectile(sourceId, impactPoint);
            }
        } else {
            this.entityFactory.effect.createExplosion(impactPoint);
        }
    }

    _resolvePhysicalCollision(sourceData, targetId, impactPoint) {
        const idA = sourceData.entityId;
        const physicsA = sourceData.physics;
        const idB = targetId;
        const physicsB = this.world.getComponent(idB, 'PhysicsComponent');
        if (!physicsB) return;
        
        const transformA = this.world.getComponent(idA, 'TransformComponent');
        const transformB = this.world.getComponent(idB, 'TransformComponent');
        
        const collisionNormal = transformA.position.clone().sub(transformB.position).normalize();
        const relativeVelocity = physicsA.velocity.clone().sub(physicsB.velocity);
        const impactSpeed = -relativeVelocity.dot(collisionNormal);

        if (impactSpeed < 0) return;

        const impactEnergy = Math.min(physicsA.mass, physicsB.mass) * impactSpeed;
        if (impactEnergy < this.balanceConfig.minImpactEnergyThreshold) return;

        const damage = Math.min(impactEnergy * this.balanceConfig.damageScalar, this.balanceConfig.maxCollisionDamage);
        
        // FIX: Log damage from both sides of the collision
        if (this.world.getComponent(idA, 'HealthComponent')) {
            this.world.publish('damage', { targetId: idA, amount: damage, impactPoint, impactNormal: collisionNormal.clone().negate(), attackerId: idB });
        }
        if (this.world.getComponent(idB, 'HealthComponent')) {
            this.world.publish('damage', { targetId: idB, amount: damage, impactPoint, impactNormal: collisionNormal, attackerId: idA });
        }
        
        if (physicsA.bodyType === 'static' && physicsB.bodyType === 'static') return;
        const impulseMagnitude = impactSpeed * (1 + this.balanceConfig.elasticity);
        const impulse = collisionNormal.clone().multiplyScalar(impulseMagnitude);

        if (physicsA.bodyType === 'dynamic') physicsA.velocity.add(impulse.clone().multiplyScalar(1 / physicsA.mass));
        if (physicsB.bodyType === 'dynamic') physicsB.velocity.sub(impulse.clone().multiplyScalar(1 / physicsB.mass));
    }
    
    _applyAoeDamage(center, weaponData, sourceFaction, originId) {
        const radius = weaponData.explosionRadius;
        const maxDamage = weaponData.damage;

        const size = new THREE.Vector3(1, 1, 1).multiplyScalar(radius * 2);
        this.aoeQueryBox.setFromCenterAndSize(center, size);
        const nearbyEntities = this.spatialGrid.getNearby({ boundingBox: this.aoeQueryBox });

        for (const potentialTarget of nearbyEntities) {
            const targetId = potentialTarget.entityId;
            const health = this.world.getComponent(targetId, 'HealthComponent');
            const transform = this.world.getComponent(targetId, 'TransformComponent');
            if (!health || health.isDestroyed || !transform) continue;

            const faction = this.world.getComponent(targetId, 'FactionComponent');
            if (faction && faction.name === sourceFaction) continue;

            const distance = center.distanceTo(transform.position);
            if (distance < radius) {
                const damageFalloff = 1 - (distance / radius);
                const damage = maxDamage * damageFalloff;
                
                this.world.publish('damage', {
                    targetId: targetId,
                    amount: damage,
                    impactPoint: transform.position,
                    impactNormal: null,
                    attackerId: originId
                });
            }
        }
    }

    _destroyProjectile(projectileId, impactPoint) {
       const health = this.world.getComponent(projectileId, 'HealthComponent');
        if (health && !health.isDestroyed) {
            health.isDestroyed = true;
            let finalImpactPoint = impactPoint;
            if (!finalImpactPoint) {
                 const transform = this.world.getComponent(projectileId, 'TransformComponent');
                 if(transform) finalImpactPoint = transform.position;
            }
            if(finalImpactPoint) this.entityFactory.effect.createExplosion(finalImpactPoint);
        }
    }
}