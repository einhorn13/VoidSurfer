import * as THREE from 'three';
import { BaseAssembler } from './BaseAssembler.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { CollisionComponent } from '../components/CollisionComponent.js';
import { ProjectileComponent } from '../components/ProjectileComponent.js';
import { LifetimeComponent } from '../components/LifetimeComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { StaticDataComponent } from '../components/StaticDataComponent.js';

const MAX_PROJECTILES = 200;

export class ProjectileAssembler extends BaseAssembler {
    constructor() {
        super();
        this.pool = [];
        this.nextAvailableIndex = 0;
    }

    init() {
        console.log("Initializing projectile pool...");
        for (let i = 0; i < MAX_PROJECTILES; i++) {
            this._createProjectileEntity();
        }
        console.log(`Projectile pool created with ${this.pool.length} instances.`);
    }

    _createProjectileEntity() {
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        this.scene.add(mesh);
        
        const health = new HealthComponent({ hull: 1, maxHull: 1, shield: 0, shieldRegenRate: 0 });
        health.state = 'CLEANUP_PENDING';

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position: new THREE.Vector3(0, 0, -25000) }))
            .with(new PhysicsComponent({ mass: 0.1, bodyType: 'dynamic' }))
            .with(new RenderComponent(mesh))
            .with(new CollisionComponent())
            .with(new ProjectileComponent({ damage: 0, faction: null, originId: null, weaponData: {} }))
            .with(new LifetimeComponent(0))
            .with(health)
            .with(new StaticDataComponent({ type: 'projectile_pooled' }))
            .build();
        
        this.pool.push(entityId);
    }

    getProjectile(originEntityId, hardpoint) {
        for (let i = 0; i < this.pool.length; i++) {
            const poolIndex = (this.nextAvailableIndex + i) % this.pool.length;
            const entityId = this.pool[poolIndex];
            const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');

            if (health && health.state !== 'ALIVE') {
                this.nextAvailableIndex = (poolIndex + 1) % this.pool.length;
                this._activateProjectile(entityId, originEntityId, hardpoint);
                return entityId;
            }
        }
        console.warn('Projectile pool exhausted.');
        return null;
    }

    _activateProjectile(entityId, originEntityId, hardpoint) {
        const originTransform = this.ecsWorld.getComponent(originEntityId, 'TransformComponent');
        const originPhysics = this.ecsWorld.getComponent(originEntityId, 'PhysicsComponent');
        const originFaction = this.ecsWorld.getComponent(originEntityId, 'FactionComponent');
        if (!originTransform || !originPhysics || !originFaction) return;

        const weaponData = hardpoint.weapon;
        const offset = new THREE.Vector3().fromArray(hardpoint.pos || [0, 0, 0]);
        const startPosition = offset.applyQuaternion(originTransform.rotation).add(originTransform.position);
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(originTransform.rotation);
        const finalVelocity = originPhysics.velocity.clone().add(forward.multiplyScalar(weaponData.speed));

        const transform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
        transform.position.copy(startPosition);
        transform.rotation.copy(originTransform.rotation);

        const physics = this.ecsWorld.getComponent(entityId, 'PhysicsComponent');
        physics.velocity.copy(finalVelocity);

        const projectile = this.ecsWorld.getComponent(entityId, 'ProjectileComponent');
        projectile.damage = weaponData.damage;
        projectile.faction = originFaction.name;
        projectile.originId = originEntityId;
        projectile.weaponData = weaponData;
        projectile.pierceLeft = weaponData.pierce || 0;

        const lifetime = this.ecsWorld.getComponent(entityId, 'LifetimeComponent');
        lifetime.timeLeft = weaponData.lifetime || 3.0;
        
        const collision = this.ecsWorld.getComponent(entityId, 'CollisionComponent');
        collision.boundingSphere.radius = weaponData.collisionRadius || 1.0;

        const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
        health.state = 'ALIVE';
        health.hull.current = 1;

        const render = this.ecsWorld.getComponent(entityId, 'RenderComponent');
        render.mesh.material.color.setHex(parseInt(weaponData.color, 16));
        render.mesh.visible = true;
    }

    releaseProjectile(entityId) {
        const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
        if (health && health.state === 'ALIVE') {
            health.state = 'CLEANUP_PENDING';

            const render = this.ecsWorld.getComponent(entityId, 'RenderComponent');
            if (render) render.mesh.visible = false;
            
            const transform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
            if (transform) transform.position.set(0, 0, -25000); 

            const physics = this.ecsWorld.getComponent(entityId, 'PhysicsComponent');
            if(physics) physics.velocity.set(0,0,0);
        }
    }
}