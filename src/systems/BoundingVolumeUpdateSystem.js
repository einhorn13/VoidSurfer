// src/systems/BoundingVolumeUpdateSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';

export class BoundingVolumeUpdateSystem extends System {
    constructor(world) {
        super(world);
        this.tempBox = new THREE.Box3();
    }

    update(delta) {
        const entities = this.world.query(['TransformComponent', 'CollisionComponent']);
        for (const entityId of entities) {
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const collision = this.world.getComponent(entityId, 'CollisionComponent');
            
            // Step 1: Always update the center of the sphere from the transform.
            collision.boundingSphere.center.copy(transform.position);

            const render = this.world.getComponent(entityId, 'RenderComponent');
            if (render && render.isInstanced) {
                // For instanced meshes (asteroids), we still need to calculate radius based on scale.
                if (render.mesh.geometry && render.mesh.geometry.boundingSphere) {
                    const baseRadius = render.mesh.geometry.boundingSphere.radius;
                    const maxScale = Math.max(render.scale.x, render.scale.y, render.scale.z);
                    collision.boundingSphere.radius = baseRadius * maxScale;
                }
            }
            // FIX: Removed the logic that incorrectly recalculated the sphere for ships (Groups).
            // For ships, projectiles, loot, planets, etc., the radius is now set once
            // in their respective assemblers and will not be changed here.
            
            // Step 2: Always update the bounding box from the sphere's final state for this frame.
            collision.boundingSphere.getBoundingBox(collision.boundingBox);
        }
    }
}