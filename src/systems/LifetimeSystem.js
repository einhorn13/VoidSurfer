// src/systems/LifetimeSystem.js
import { System } from '../ecs/System.js';

/**
 * Manages the lifecycle of all entities with a limited duration.
 */
export class LifetimeSystem extends System {
    update(delta) {
        const entities = this.world.query(['LifetimeComponent', 'HealthComponent']);

        for (const entityId of entities) {
            const lifetime = this.world.getComponent(entityId, 'LifetimeComponent');
            const health = this.world.getComponent(entityId, 'HealthComponent');

            if (health.isDestroyed) continue;

            lifetime.timeLeft -= delta;
            if (lifetime.timeLeft <= 0) {
                health.isDestroyed = true;
            }
        }
    }
}