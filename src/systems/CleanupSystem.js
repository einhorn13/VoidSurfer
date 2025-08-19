// src/systems/CleanupSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class CleanupSystem extends System {
    constructor(world) {
        super(world);
        this.scene = serviceLocator.get('Scene');
        this.entityAssembler = serviceLocator.get('EntityFactory');
    }

    update(delta) {
        const entities = this.world.query(['HealthComponent']);
        
        for (const entityId of entities) {
            const health = this.world.getComponent(entityId, 'HealthComponent');

            if (health.isDestroyed && !health.isCleanedUp) {
                const render = this.world.getComponent(entityId, 'RenderComponent');
                if (render && render.isInstanced) {
                    const staticData = this.world.getComponent(entityId, 'StaticDataComponent');
                    if (staticData) {
                        this.entityAssembler.environment.releaseInstanceId(staticData.data.id, render.instanceId);
                    }
                }
                
                this.cleanupEntity(entityId);
                health.isCleanedUp = true;
            }
        }
    }

    _disposeMaterial(material) {
        material.dispose();
        // Dispose textures
        for (const key of Object.keys(material)) {
            const value = material[key];
            if (value instanceof THREE.Texture) {
                value.dispose();
            }
        }
        // Dispose shader textures
        if (material.uniforms) {
            for (const key of Object.keys(material.uniforms)) {
                const uniform = material.uniforms[key];
                if (uniform.value instanceof THREE.Texture) {
                    uniform.value.dispose();
                }
            }
        }
    }

    cleanupEntity(entityId) {
        const trail = this.world.getComponent(entityId, 'EngineTrailComponent');
        if (trail && trail.trailInstance) {
            trail.trailInstance.dispose();
        }

        const healthBar = this.world.getComponent(entityId, 'HealthBarComponent');
        if (healthBar) {
            this.scene.remove(healthBar.sprite);
            // Health bar has explicit cleanup, as it's not a standard mesh
            if (healthBar.sprite.material.map) {
                healthBar.sprite.material.map.dispose();
            }
            healthBar.sprite.material.dispose();
        }

        const render = this.world.getComponent(entityId, 'RenderComponent');
        if (render && render.mesh && !render.isInstanced) {
            render.mesh.traverse(child => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => this._disposeMaterial(mat));
                    } else if (child.material) {
                        this._disposeMaterial(child.material);
                    }
                }
            });
            this.scene.remove(render.mesh);
        }
        
        this.world.removeEntity(entityId);
    }
}