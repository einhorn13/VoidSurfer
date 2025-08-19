// src/systems/EngineTrailSystem.js
import { System } from '../ecs/System.js';

export class EngineTrailSystem extends System {
    update(delta) {
        const entities = this.world.query(['EngineTrailComponent', 'PhysicsComponent', 'RenderComponent', 'HealthComponent', 'TransformComponent']);

        for (const entityId of entities) {
            const trail = this.world.getComponent(entityId, 'EngineTrailComponent');
            const physics = this.world.getComponent(entityId, 'PhysicsComponent');
            const health = this.world.getComponent(entityId, 'HealthComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');

            if (health && health.isDestroyed) {
                trail.trailInstance.stop();
            }

            const shipData = {
                isAccelerating: physics.isAccelerating,
                boostMultiplier: physics.boostMultiplier,
                transform: transform, // Instead of render.mesh
                velocity: physics.velocity
            };

            trail.trailInstance.update(delta, shipData);
        }
    }
}