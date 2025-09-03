import * as THREE from 'three';
import { System } from '../ecs/System.js';

export class BoundingVolumeUpdateSystem extends System {
    constructor(world) {
        super(world);
        this.tempBox = new THREE.Box3();
        this.tempSphere = new THREE.Sphere();
        this.tempBoxForSphere = new THREE.Box3(); // Helper for union operation
    }

    update(delta) {
        const entities = this.world.query(['TransformComponent', 'CollisionComponent']);
        for (const entityId of entities) {
            const health = this.world.getComponent(entityId, 'HealthComponent');
            if (health && health.state !== 'ALIVE') continue;

            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const collision = this.world.getComponent(entityId, 'CollisionComponent');
            const render = this.world.getComponent(entityId, 'RenderComponent');

            // Handle complex objects with multiple local volumes
            if (collision.localVolumes.length > 0) {
                // Ensure world volumes array matches local volumes array
                while (collision.volumes.length < collision.localVolumes.length) {
                    collision.volumes.push(new THREE.Sphere());
                }

                // Update each world volume based on its local counterpart and the entity's transform
                for (let i = 0; i < collision.localVolumes.length; i++) {
                    const localVolume = collision.localVolumes[i];
                    const worldVolume = collision.volumes[i];
                    
                    worldVolume.center.copy(localVolume.center).applyQuaternion(transform.rotation).add(transform.position);
                    worldVolume.radius = localVolume.radius;
                }
                
                // Recompute the main bounding sphere to encompass all updated world volumes
                this.tempBox.makeEmpty();
                for (const volume of collision.volumes) {
                    volume.getBoundingBox(this.tempBoxForSphere);
                    this.tempBox.union(this.tempBoxForSphere);
                }
                this.tempBox.getBoundingSphere(collision.boundingSphere);

            } else {
                // Handle simple objects (default behavior)
                collision.boundingSphere.center.copy(transform.position);
                if (render && render.isInstanced && render.mesh.geometry?.boundingSphere) {
                    const baseRadius = render.mesh.geometry.boundingSphere.radius;
                    const maxScale = Math.max(render.scale.x, render.scale.y, render.scale.z);
                    collision.boundingSphere.radius = baseRadius * maxScale;
                } else if (render && render.mesh.geometry?.boundingSphere) {
                    // This handles non-instanced meshes like player ships
                    const baseRadius = render.mesh.geometry.boundingSphere.radius;
                    collision.boundingSphere.radius = baseRadius;
                }
            }
            
            collision.boundingSphere.getBoundingBox(collision.boundingBox);
        }
    }
}