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
import { StaticDataComponent } from '../components/StaticDataComponent.js';

export class EffectAssembler extends BaseAssembler {
    constructor() {
        super();
        this.damageNumberPool = [];
        this.nextDamageNumberIndex = 0;
        this.maxDamageNumbers = this.dataManager.getConfig('game_balance').gameplay.effects.damageNumberPoolSize || 50;
    }

    init() {
        console.log("Initializing damage number pool...");
        for (let i = 0; i < this.maxDamageNumbers; i++) {
            this._createPooledDamageNumberEntity();
        }
        console.log(`Damage number pool created with ${this.damageNumberPool.length} instances.`);
    }

    _createPooledDamageNumberEntity() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.visible = false;
        sprite.userData.canvas = canvas;
        sprite.userData.aspect = canvas.width / canvas.height;

        const health = new HealthComponent({ hull: 1, maxHull: 1, shield: 0, shieldRegenRate: 0 });
        health.state = 'CLEANUP_PENDING';

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position: new THREE.Vector3(0, 0, -50000) }))
            .with(new RenderComponent(sprite))
            .with(new DamageNumberComponent())
            .with(new LifetimeComponent(1.5))
            .with(health)
            .with(new StaticDataComponent({ type: 'damage_number_pooled' }))
            .build();
        
        this.scene.add(sprite);
        this.damageNumberPool.push(entityId);
    }

    getDamageNumber(position, amount) {
        for (let i = 0; i < this.damageNumberPool.length; i++) {
            const poolIndex = (this.nextDamageNumberIndex + i) % this.damageNumberPool.length;
            const entityId = this.damageNumberPool[poolIndex];
            const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');

            if (health && health.state !== 'ALIVE') {
                this.nextDamageNumberIndex = (poolIndex + 1) % this.damageNumberPool.length;
                this._activateDamageNumber(entityId, position, amount);
                return entityId;
            }
        }
        console.warn('Damage number pool exhausted.');
        return null;
    }

    _activateDamageNumber(entityId, position, amount) {
        const transform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
        transform.position.copy(position);

        const lifetime = this.ecsWorld.getComponent(entityId, 'LifetimeComponent');
        lifetime.timeLeft = 1.5;

        const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
        health.state = 'ALIVE';
        health.hull.current = 1;

        const render = this.ecsWorld.getComponent(entityId, 'RenderComponent');
        const canvas = render.mesh.userData.canvas;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const fontSize = 48;
        ctx.font = `bold ${fontSize}px Arial`;
        const text = Math.round(amount).toString();
        
        const textX = canvas.width / 2;
        const textY = canvas.height / 2;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 6;
        ctx.strokeText(text, textX, textY);
        ctx.fillStyle = 'white';
        ctx.fillText(text, textX, textY);

        render.mesh.material.map.needsUpdate = true;
        render.mesh.visible = true;
    }

    releaseDamageNumber(entityId) {
        const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
        if (health && health.state === 'ALIVE') {
            health.state = 'CLEANUP_PENDING';
            
            const render = this.ecsWorld.getComponent(entityId, 'RenderComponent');
            if (render) render.mesh.visible = false;

            const transform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
            if (transform) transform.position.set(0, 0, -50000);
        }
    }
    
    createExplosion(position) {
        const particleCount = 50;
        const mesh = MeshFactory.createExplosionMesh(particleCount);
        mesh.position.copy(position);

        const positions = mesh.geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
        }

        const effect = new ExplosionEffectComponent(particleCount);
        for (let i = 0; i < effect.velocities.length; i++) {
            effect.velocities[i]
                .randomDirection()
                .multiplyScalar(Math.random() * 15);
        }

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position }))
            .with(new RenderComponent(mesh))
            .with(effect)
            .with(new LifetimeComponent(1.0))
            .with(new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }))
            .build();

        this.scene.add(mesh);
        return entityId;
    }

    createHullDebris(position, impactNormal, shipVelocity, color) {
        const mesh = MeshFactory.createHullDebrisMesh(color);
        
        const effect = new DebrisEffectComponent();
        effect.rotationSpeed.set(THREE.MathUtils.randFloatSpread(5), THREE.MathUtils.randFloatSpread(5), THREE.MathUtils.randFloatSpread(5));

        const render = new RenderComponent(mesh);
        render.scale.set(THREE.MathUtils.randFloat(0.2, 0.6), THREE.MathUtils.randFloat(0.2, 0.6), THREE.MathUtils.randFloat(0.1, 0.25));

        const debrisSpeed = THREE.MathUtils.randFloat(5, 15);
        const velocity = impactNormal.clone().multiplyScalar(debrisSpeed).add(shipVelocity);
        
        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position }))
            .with(new PhysicsComponent({ velocity, mass: 0.2, bodyType: 'dynamic' }))
            .with(render)
            .with(effect)
            .with(new LifetimeComponent(THREE.MathUtils.randFloat(3.0, 5.0)))
            .with(new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }))
            .build();

        this.scene.add(mesh);
        return entityId;
    }

    createLaserBeam(start, end, color) {
        const mesh = MeshFactory.createLaserBeamMesh(start, end, color);

        const entityId = this.ecsWorld.createEntity()
            .with(new RenderComponent(mesh))
            .with(new LaserBeamComponent())
            .with(new LifetimeComponent(0.1))
            .with(new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }))
            .build();

        this.scene.add(mesh);
        return entityId;
    }

    createShieldImpact(targetEntityId, impactPoint) {
        const targetCollision = this.ecsWorld.getComponent(targetEntityId, 'CollisionComponent');
        const targetTransform = this.ecsWorld.getComponent(targetEntityId, 'TransformComponent');
        if (!targetCollision || !targetTransform) return null;
        
        const localImpactPoint = impactPoint.clone().sub(targetTransform.position);
        
        const mesh = MeshFactory.createShieldImpactMesh(targetCollision.boundingSphere.radius, localImpactPoint);
        
        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position: targetTransform.position.clone() }))
            .with(new RenderComponent(mesh))
            .with(new ShieldImpactEffectComponent(targetEntityId))
            .with(new LifetimeComponent(1.5))
            .with(new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }))
            .build();

        this.scene.add(mesh);
        return entityId;
    }
}