// src/systems/EffectSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class EffectSystem extends System {
    constructor(world) {
        super(world);
        this.camera = serviceLocator.get('Camera');
        this.deltaRotation = new THREE.Quaternion();
        this.deltaEuler = new THREE.Euler();
    }

    update(delta) {
        this._updateExplosions(delta);
        this._updateDebris(delta);
        this._updateLasers(delta);
        this._updateShieldImpacts(delta);
        this._updateSunShader(delta);
        this._updateDamageNumbers(delta);
    }

    _updateExplosions(delta) {
        const entities = this.world.query(['ExplosionEffectComponent', 'RenderComponent', 'LifetimeComponent']);
        for (const entityId of entities) {
            const effect = this.world.getComponent(entityId, 'ExplosionEffectComponent');
            const render = this.world.getComponent(entityId, 'RenderComponent');
            const lifetime = this.world.getComponent(entityId, 'LifetimeComponent');
            
            if (!render.mesh) continue;

            const positions = render.mesh.geometry.attributes.position.array;
            for (let i = 0; i < effect.velocities.length; i++) {
                positions[i*3] += effect.velocities[i].x * delta;
                positions[i*3+1] += effect.velocities[i].y * delta;
                positions[i*3+2] += effect.velocities[i].z * delta;
            }
            render.mesh.geometry.attributes.position.needsUpdate = true;
            render.mesh.material.opacity = lifetime.timeLeft;
        }
    }

    _updateDebris(delta) {
        const entities = this.world.query(['DebrisEffectComponent', 'RenderComponent', 'LifetimeComponent', 'TransformComponent']);
        for (const entityId of entities) {
            const effect = this.world.getComponent(entityId, 'DebrisEffectComponent');
            const render = this.world.getComponent(entityId, 'RenderComponent');
            const lifetime = this.world.getComponent(entityId, 'LifetimeComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');

            if (!render.mesh) continue;
            
            this.deltaEuler.set(effect.rotationSpeed.x * delta, effect.rotationSpeed.y * delta, effect.rotationSpeed.z * delta);
            this.deltaRotation.setFromEuler(this.deltaEuler);
            transform.rotation.multiply(this.deltaRotation);
            
            render.scale.multiplyScalar(1 - (0.3 * delta));
            const opacity = Math.max(0, lifetime.timeLeft / 3.0);
            render.mesh.material.opacity = opacity;
            render.mesh.material.transparent = true;
        }
    }

    _updateLasers(delta) {
        const entities = this.world.query(['LaserBeamComponent', 'RenderComponent', 'LifetimeComponent']);
        for (const entityId of entities) {
            const render = this.world.getComponent(entityId, 'RenderComponent');
            const lifetime = this.world.getComponent(entityId, 'LifetimeComponent');
            if (render.mesh) {
                render.mesh.material.opacity = lifetime.timeLeft * 10;
                if (lifetime.timeLeft <= 0) {
                    render.mesh.visible = false;
                }
            }
        }
    }

    _updateShieldImpacts(delta) {
        const entities = this.world.query(['ShieldImpactEffectComponent', 'RenderComponent', 'HealthComponent', 'TransformComponent']);
        for (const entityId of entities) {
            const health = this.world.getComponent(entityId, 'HealthComponent');
            if (health.isDestroyed) continue;

            const effect = this.world.getComponent(entityId, 'ShieldImpactEffectComponent');
            const render = this.world.getComponent(entityId, 'RenderComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const targetTransform = this.world.getComponent(effect.targetEntityId, 'TransformComponent');
            const targetHealth = this.world.getComponent(effect.targetEntityId, 'HealthComponent');

            // FIX: Re-introduce the sync logic.
            // If the target is gone, the effect should be cleaned up.
            if (!targetTransform || !targetHealth || targetHealth.isDestroyed) {
                health.isDestroyed = true;
                continue;
            }

            // The effect mesh must follow the target ship's position and rotation.
            transform.position.copy(targetTransform.position);
            transform.rotation.copy(targetTransform.rotation);
            
            effect.time += delta;
            const progress = Math.min(effect.time / effect.duration, 1.0);
            
            if (render.mesh.material.uniforms.progress) {
                render.mesh.material.uniforms.progress.value = progress;
            }
        }
    }

    _updateSunShader(delta) {
        const sunEntities = this.world.query(['CelestialBodyTag']);
        for (const entityId of sunEntities) {
            const staticData = this.world.getComponent(entityId, 'StaticDataComponent');
            if (staticData && staticData.data.type === 'sun') {
                const render = this.world.getComponent(entityId, 'RenderComponent');
                if (render && render.mesh && render.mesh.material.uniforms && render.mesh.material.uniforms.time) {
                    render.mesh.material.uniforms.time.value += delta;
                }
                break; // Assume only one sun
            }
        }
    }

    _updateDamageNumbers(delta) {
        const entities = this.world.query(['DamageNumberComponent', 'TransformComponent', 'RenderComponent', 'LifetimeComponent']);
        for (const entityId of entities) {
            const damageNumber = this.world.getComponent(entityId, 'DamageNumberComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const render = this.world.getComponent(entityId, 'RenderComponent');
            const lifetime = this.world.getComponent(entityId, 'LifetimeComponent');
            
            transform.position.add(damageNumber.velocity.clone().multiplyScalar(delta));
            
            if (render.mesh) {
                // Dynamically adjust scale to maintain constant screen size
                const distance = this.camera.position.distanceTo(transform.position);
                const apparentSizeFactor = 0.04;
                const scale = distance * apparentSizeFactor;
                const aspect = render.mesh.userData.aspect || 1;
                
                render.mesh.scale.set(scale * aspect, scale, 1.0);

                // Fade out
                const initialDuration = 1.5; // Must match LifetimeComponent duration
                render.mesh.material.opacity = Math.min(1.0, lifetime.timeLeft / (initialDuration * 0.75));
            }
        }
    }
}