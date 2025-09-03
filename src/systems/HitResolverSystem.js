import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { eventBus } from '../EventBus.js';

export class HitResolverSystem extends System {
    constructor(world) {
        super(world);
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.spatialGrid = serviceLocator.get('WorldManager').spatialGrid;
        this.aoeQueryBox = new THREE.Box3();
        this.balanceConfig = serviceLocator.get('DataManager').getConfig('game_balance');
    }

    update(delta) {
        const hitEvents = this.world.getEvents('hit');
        for (const event of hitEvents) {
            this._resolveHit(event);
        }
        
        const detonationEvents = this.world.getEvents('detonation');
        for (const event of detonationEvents) {
            this._resolveDetonation(event);
        }
    }
    
    _resolveDetonation(event) {
        const { missileId, position } = event;
        
        const missile = this.world.getComponent(missileId, 'MissileComponent');
        if (!missile) return;

        this.entityFactory.effect.createExplosion(position);
        
        if (missile.weaponData.explosionRadius > 0) {
            this._applyAoeDamage(position, missile.weaponData, missile.faction, missile.originId);
        }
    }

    _resolveHit(hitEvent) {
        const { sourceId, sourceData, targetId, impactPoint } = hitEvent;
        
        // Handle missile hitting a target
        const isMissile = sourceId && this.world.getComponent(sourceId, 'MissileComponent');
        if (isMissile) {
            const stateComp = this.world.getComponent(sourceId, 'StateComponent');
            const armingState = stateComp?.states.get('ARMING');
            if (armingState && armingState.timeLeft <= 0) {
                this.world.publish('detonation', { missileId: sourceId, position: impactPoint });
                const health = this.world.getComponent(sourceId, 'HealthComponent');
                if (health) health.state = 'DESTROYED';
            }
            return;
        }

        // Handle something hitting a missile
        const targetIsMissile = this.world.getComponent(targetId, 'MissileComponent');
        if (targetIsMissile) {
            const homing = this.world.getComponent(targetId, 'HomingComponent');
            if (homing && homing.notificationSent) {
                eventBus.emit('notification', { text: 'Incoming missile neutralized', type: 'success' });
            }
        }

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
            if (sourceProjectile) {
                sourceWeaponData = sourceProjectile.weaponData;
                sourceFaction = sourceProjectile.faction;
                sourceOriginId = sourceProjectile.originId;
            } else {
                return;
            }
        }

        const targetHealth = this.world.getComponent(targetId, 'HealthComponent');
        if (!targetHealth || targetHealth.state !== 'ALIVE') return;
        if (targetId === sourceOriginId) return;
        
        const targetFactionComp = this.world.getComponent(targetId, 'FactionComponent');
        if (!sourceFaction) return;
        if (targetFactionComp && targetFactionComp.name === sourceFaction) return;
        
        const targetTransform = this.world.getComponent(targetId, 'TransformComponent');
        if (!targetTransform) return;

        let impactNormal = new THREE.Vector3().subVectors(impactPoint, targetTransform.position);
        if (impactNormal.lengthSq() < 0.001) {
            const attackerTransform = this.world.getComponent(sourceOriginId, 'TransformComponent');
            if (attackerTransform) {
                impactNormal.subVectors(targetTransform.position, attackerTransform.position).normalize();
            } else {
                impactNormal.set(0, 0, 1);
            }
        } else {
            impactNormal.normalize();
        }

        this.world.publish('damage', {
            targetId: targetId,
            amount: sourceWeaponData.damage,
            impactPoint: impactPoint,
            impactNormal: impactNormal,
            attackerId: sourceOriginId,
            weaponData: sourceWeaponData
        });
        
        if (sourceWeaponData.explosionRadius > 0) {
            this._applyAoeDamage(impactPoint, sourceWeaponData, sourceFaction, sourceOriginId);
        }
        
        if (sourceId) {
            const sourceProjectile = this.world.getComponent(sourceId, 'ProjectileComponent');
            if (sourceProjectile) {
                 sourceProjectile.pierceLeft -= 1;
                if (sourceProjectile.pierceLeft < 0) {
                    this._destroyProjectile(sourceId);
                }
            }
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
        
        const collisionNormal = transformA.position.clone().sub(transformB.position);
        if (collisionNormal.lengthSq() < 0.001) {
            collisionNormal.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        } else {
            collisionNormal.normalize();
        }

        const relativeVelocity = physicsA.velocity.clone().sub(physicsB.velocity);
        const impactSpeed = -relativeVelocity.dot(collisionNormal);

        if (impactSpeed <= 0) return;
        
        const isPlayer = !!this.world.getComponent(idA, 'PlayerControlledComponent') || !!this.world.getComponent(idB, 'PlayerControlledComponent');
        const isStation = !!this.world.getComponent(idA, 'StationComponent') || !!this.world.getComponent(idB, 'StationComponent');
        
        if (isPlayer && isStation) {
            const playerId = this.world.getComponent(idA, 'PlayerControlledComponent') ? idA : idB;
            const penaltyConfig = this.balanceConfig.gameplay.station.collisionPenalty;
            if (impactSpeed > penaltyConfig.minSpeed) {
                const stats = this.world.getComponent(playerId, 'PlayerStatsComponent');
                if (stats && stats.credits >= penaltyConfig.creditFine) {
                    stats.credits -= penaltyConfig.creditFine;
                    eventBus.emit('player_stats_updated');
                    eventBus.emit('notification', { text: `Fine: ${penaltyConfig.creditFine} CR for reckless flying`, type: 'danger' });
                }
            }
        }

        let impactEnergy;
        if (physicsA.bodyType === 'dynamic' && physicsB.bodyType === 'static') {
            impactEnergy = physicsA.mass * impactSpeed;
        } else if (physicsB.bodyType === 'dynamic' && physicsA.bodyType === 'static') {
            impactEnergy = physicsB.mass * impactSpeed;
        } else {
            // Collision between two dynamic bodies
            impactEnergy = Math.min(physicsA.mass, physicsB.mass) * impactSpeed;
        }
        
        if (impactEnergy < this.balanceConfig.collisionPhysics.minImpactEnergyThreshold) return;

        const damage = Math.min(impactEnergy * this.balanceConfig.collisionPhysics.damageScalar, this.balanceConfig.collisionPhysics.maxCollisionDamage);
        
        if (this.world.getComponent(idA, 'HealthComponent')) {
            this.world.publish('damage', { targetId: idA, amount: damage, impactPoint, impactNormal: collisionNormal.clone().negate(), attackerId: idB });
        }
        if (this.world.getComponent(idB, 'HealthComponent')) {
            this.world.publish('damage', { targetId: idB, amount: damage, impactPoint, impactNormal: collisionNormal, attackerId: idA });
        }
        
        if (physicsA.bodyType === 'static' && physicsB.bodyType === 'static') return;
        
        const impulseMagnitude = impactSpeed * (1 + this.balanceConfig.collisionPhysics.elasticity);
        const impulse = collisionNormal.clone().multiplyScalar(impulseMagnitude);

        const totalInverseMass = (1 / physicsA.mass) + (1 / physicsB.mass);
        if (totalInverseMass <= 0) return;

        if (physicsA.bodyType === 'dynamic') {
             physicsA.velocity.add(impulse.clone().multiplyScalar(1 / physicsA.mass));
        }
        if (physicsB.bodyType === 'dynamic') {
            physicsB.velocity.sub(impulse.clone().multiplyScalar(1 / physicsB.mass));
        }
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
            if (!health || health.state !== 'ALIVE' || !transform) continue;

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
                    attackerId: originId,
                    weaponData: weaponData
                });
            }
        }
    }

    _destroyProjectile(projectileId) {
        const isPooled = this.world.getComponent(projectileId, 'StaticDataComponent')?.data.type === 'projectile_pooled';
        if (isPooled) {
            this.entityFactory.projectile.releaseProjectile(projectileId);
        } else {
            const health = this.world.getComponent(projectileId, 'HealthComponent');
            if (health && health.state === 'ALIVE') {
                health.state = 'DESTROYED';
            }
        }
    }
}