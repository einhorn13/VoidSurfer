// src/systems/LifetimeSystem.js
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

/**
 * Manages the lifecycle of all entities with a limited duration.
 */
export class LifetimeSystem extends System {
    constructor(world) {
        super(world);
        this.entityFactory = serviceLocator.get('EntityFactory');
    }

    update(delta) {
        const entities = this.world.query(['LifetimeComponent', 'HealthComponent']);

        for (const entityId of entities) {
            const lifetime = this.world.getComponent(entityId, 'LifetimeComponent');
            const health = this.world.getComponent(entityId, 'HealthComponent');

            if (health.state !== 'ALIVE') continue;

            lifetime.timeLeft -= delta;
            if (lifetime.timeLeft <= 0) {
                const staticData = this.world.getComponent(entityId, 'StaticDataComponent');
                const type = staticData?.data.type;

                if (type === 'projectile_pooled') {
                    this.entityFactory.projectile.releaseProjectile(entityId);
                } else if (type === 'damage_number_pooled') {
                    this.entityFactory.effect.releaseDamageNumber(entityId);
                } else {
                    health.state = 'DESTROYED';
                }
            }
        }
    }
}