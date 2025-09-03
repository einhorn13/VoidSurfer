import { System } from '../ecs/System.js';

export class EngineTrailSystem extends System {
    update(delta) {
        const entities = this.world.query(['EngineTrailComponent', 'PhysicsComponent', 'CollisionComponent', 'HealthComponent', 'TransformComponent']);

        for (const entityId of entities) {
            const trail = this.world.getComponent(entityId, 'EngineTrailComponent');
            const physics = this.world.getComponent(entityId, 'PhysicsComponent');
            const health = this.world.getComponent(entityId, 'HealthComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const collision = this.world.getComponent(entityId, 'CollisionComponent');

            if (health && health.state !== 'ALIVE') {
                trail.trailInstance.stop();
            }

            const shipData = {
                isAccelerating: physics.isAccelerating,
                boostMultiplier: physics.boostMultiplier,
                transform: transform,
                velocity: physics.velocity,
                radius: collision.boundingSphere.radius,
            };

            trail.trailInstance.update(delta, shipData);
        }
    }
}