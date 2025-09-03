import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { eventBus } from '../EventBus.js';

export class DamageSystem extends System {
    constructor(world) {
        super(world);
        this.entityFactory = serviceLocator.get('EntityFactory');
    }

    applyDamage(entityId, amount, impactPoint, impactNormal, attackerId, weaponData) {
        const health = this.world.getComponent(entityId, 'HealthComponent');
        if (!health || health.state !== 'ALIVE') return;

        const healthBar = this.world.getComponent(entityId, 'HealthBarComponent');
        if (healthBar) {
            healthBar.needsUpdate = true;
        }

        eventBus.emit('debug_damage_event', {
            attackerId,
            targetId: entityId,
            amount,
            weaponData
        });

        if (attackerId !== undefined && amount > 0) {
            const currentDamage = health.damageLog.get(attackerId) || 0;
            health.damageLog.set(attackerId, currentDamage + amount);
        }

        const finalImpactPoint = impactPoint || this.world.getComponent(entityId, 'TransformComponent')?.position;
        const staticData = this.world.getComponent(entityId, 'StaticDataComponent');

        if (amount > 0 && finalImpactPoint && staticData?.data.type !== 'station') {
            this.entityFactory.spawnDamageNumber(finalImpactPoint, amount);
        }

        const isPlayer = !!this.world.getComponent(entityId, 'PlayerControlledComponent');
        const isShip = staticData?.data.type === 'ship';

        if (isPlayer) {
            eventBus.emit('player_damage_effect');
        }
        
        const shieldBeforeDamage = health.shield.current;
        let hullDamage = 0;
        
        if (health.shield.current > 0) {
            const shieldDamage = Math.min(health.shield.current, amount);
            health.shield.current -= shieldDamage;
            hullDamage = amount - shieldDamage;
            
            if (isShip && finalImpactPoint && impactNormal) {
                this.entityFactory.effect.createShieldImpact(entityId, finalImpactPoint);
            }

            if (hullDamage > 0) {
                health.hull.current -= hullDamage;
            }
        } else {
            hullDamage = amount;
            health.hull.current -= hullDamage;
        }

        if (isShip && hullDamage > 5 && finalImpactPoint && impactNormal) {
            const physics = this.world.getComponent(entityId, 'PhysicsComponent');
            const shipColor = staticData?.data?.proceduralModel?.color || 'cccccc';
            this.entityFactory.effect.createHullDebris(finalImpactPoint, impactNormal, physics.velocity, shipColor);
        }

        if (isPlayer && shieldBeforeDamage > 0 && health.shield.current <= 0) {
            eventBus.emit('notification', { text: 'Shields offline!', type: 'danger' });
        }

        if (health.hull.current <= 0) {
            health.state = 'DESTROYED';

            const render = this.world.getComponent(entityId, 'RenderComponent');
            if (render) render.isVisible = false;
            
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            if (transform) {
                this.entityFactory.effect.createExplosion(transform.position);

                if (staticData?.data.type === 'asteroid') {
                    const asteroidColor = staticData.data.color || '888888';
                    const physics = this.world.getComponent(entityId, 'PhysicsComponent');
                    for (let i = 0; i < 5; i++) {
                        const randomNormal = new THREE.Vector3().randomDirection();
                        this.entityFactory.effect.createHullDebris(transform.position, randomNormal, physics.velocity, asteroidColor);
                    }
                }
            }
        }
    }

    update(delta) {
        const damageEvents = this.world.getEvents('damage');
        for (const event of damageEvents) {
            this.applyDamage(
                event.targetId,
                event.amount,
                event.impactPoint,
                event.impactNormal,
                event.attackerId,
                event.weaponData
            );
        }
    }
}