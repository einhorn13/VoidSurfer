// src/assemblers/EffectAssembler.js
import * as THREE from 'three';
import { BaseAssembler } from './BaseAssembler.js';
import { MeshFactory } from '../MeshFactory.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { LifetimeComponent } from '../components/LifetimeComponent.js';
import { ExplosionEffectComponent } from '../components/ExplosionEffectComponent.js';
import { DebrisEffectComponent } from '../components/DebrisEffectComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { LaserBeamComponent } from '../components/LaserBeamComponent.js';
import { ShieldImpactEffectComponent } from '../components/ShieldImpactEffectComponent.js';
import { DamageNumberComponent } from '../components/DamageNumberComponent.js';

export class EffectAssembler extends BaseAssembler {
    createExplosion(position) {
        const entityId = this.ecsWorld.createEntity();
        const particleCount = 50;
        const mesh = MeshFactory.createExplosionMesh(particleCount);
        mesh.position.copy(position);

        const effect = new ExplosionEffectComponent(particleCount);
        for (let i = 0; i < effect.velocities.length; i++) {
            effect.velocities[i].set(
                Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5
            ).normalize().multiplyScalar(Math.random() * 15);
        }

        this.ecsWorld.addComponent(entityId, new TransformComponent({ position }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, effect);
        this.ecsWorld.addComponent(entityId, new LifetimeComponent(1.0));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }));

        this.scene.add(mesh);
        return entityId;
    }

    createHullDebris(position, impactNormal, shipVelocity, color) {
        const entityId = this.ecsWorld.createEntity();
        const mesh = MeshFactory.createHullDebrisMesh(color);
        
        const effect = new DebrisEffectComponent();
        effect.rotationSpeed.set(THREE.MathUtils.randFloatSpread(5), THREE.MathUtils.randFloatSpread(5), THREE.MathUtils.randFloatSpread(5));

        const render = new RenderComponent(mesh);
        render.scale.set(THREE.MathUtils.randFloat(0.2, 0.6), THREE.MathUtils.randFloat(0.2, 0.6), THREE.MathUtils.randFloat(0.1, 0.25));

        const debrisSpeed = THREE.MathUtils.randFloat(5, 15);
        const velocity = impactNormal.clone().multiplyScalar(debrisSpeed).add(shipVelocity);
        
        this.ecsWorld.addComponent(entityId, new TransformComponent({ position }));
        this.ecsWorld.addComponent(entityId, new PhysicsComponent({ velocity, mass: 0.2, bodyType: 'dynamic' }));
        this.ecsWorld.addComponent(entityId, render);
        this.ecsWorld.addComponent(entityId, effect);
        this.ecsWorld.addComponent(entityId, new LifetimeComponent(THREE.MathUtils.randFloat(3.0, 5.0)));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }));

        this.scene.add(mesh);
        return entityId;
    }

    createLaserBeam(start, end, color) {
        const entityId = this.ecsWorld.createEntity();
        const mesh = MeshFactory.createLaserBeamMesh(start, end, color);

        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, new LaserBeamComponent());
        this.ecsWorld.addComponent(entityId, new LifetimeComponent(0.1));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }));

        this.scene.add(mesh);
        return entityId;
    }

    createShieldImpact(targetEntityId, impactPoint) {
        const entityId = this.ecsWorld.createEntity();
        const targetCollision = this.ecsWorld.getComponent(targetEntityId, 'CollisionComponent');
        const targetTransform = this.ecsWorld.getComponent(targetEntityId, 'TransformComponent');
        if (!targetCollision || !targetTransform) return null;

        // Convert world-space impact point to the target's local space for the shader.
        const localImpactPoint = targetTransform.position.clone().sub(impactPoint);
        
        const mesh = MeshFactory.createShieldImpactMesh(targetCollision.boundingSphere.radius, localImpactPoint);
        
        // The effect starts at the target's position and will be synced by EffectSystem.
        this.ecsWorld.addComponent(entityId, new TransformComponent({ position: targetTransform.position.clone() }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, new ShieldImpactEffectComponent(targetEntityId)); // FIX: Pass the targetId back in.
        this.ecsWorld.addComponent(entityId, new LifetimeComponent(1.5));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }));

        this.scene.add(mesh);
        return entityId;
    }

    createDamageNumber(position, amount) {
        const entityId = this.ecsWorld.createEntity();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 48;
        ctx.font = `bold ${fontSize}px Arial`;
        
        const text = Math.round(amount).toString();
        const textMetrics = ctx.measureText(text);
        canvas.width = textMetrics.width + 16;
        canvas.height = fontSize + 16;

        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 6;
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = 'white';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        
        const aspect = canvas.width / canvas.height;
        sprite.userData.aspect = aspect; // Store aspect for later use
        sprite.scale.set(1, 1, 1); // Start with a neutral scale
        
        this.ecsWorld.addComponent(entityId, new TransformComponent({ position: position.clone() }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(sprite));
        this.ecsWorld.addComponent(entityId, new DamageNumberComponent());
        this.ecsWorld.addComponent(entityId, new LifetimeComponent(1.5));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: 1, maxHull: 1, shield: 0, shieldRegenRate: 0 }));
        
        this.scene.add(sprite);
        return entityId;
    }
}