// src/assemblers/ProjectileAssembler.js
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

export class ProjectileAssembler extends BaseAssembler {
    createPlasmaBolt(originEntityId, hardpoint) {
        const originTransform = this.ecsWorld.getComponent(originEntityId, 'TransformComponent');
        const originPhysics = this.ecsWorld.getComponent(originEntityId, 'PhysicsComponent');
        const originFaction = this.ecsWorld.getComponent(originEntityId, 'FactionComponent');
        if (!originTransform || !originPhysics || !originFaction) return null;

        const entityId = this.ecsWorld.createEntity();
        const weaponData = hardpoint.weapon;
        
        const geometry = new THREE.SphereGeometry(0.3, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: parseInt(weaponData.color, 16) });
        const mesh = new THREE.Mesh(geometry, material);

        const offset = new THREE.Vector3().fromArray(hardpoint.pos || [0, 0, 0]);
        const startPosition = offset.applyQuaternion(originTransform.rotation).add(originTransform.position);
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(originTransform.rotation);
        
        const shipVelocity = originPhysics.velocity.clone();
        const projectileThrust = forward.clone().multiplyScalar(weaponData.speed);
        const finalVelocity = shipVelocity.add(projectileThrust);

        this.ecsWorld.addComponent(entityId, new TransformComponent({ position: startPosition, rotation: originTransform.rotation.clone() }));
        this.ecsWorld.addComponent(entityId, new PhysicsComponent({ velocity: finalVelocity, mass: 0.1, bodyType: 'dynamic' }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        
        const collision = new CollisionComponent();
        collision.boundingSphere.radius = weaponData.collisionRadius || 1.0;
        this.ecsWorld.addComponent(entityId, collision);

        this.ecsWorld.addComponent(entityId, new ProjectileComponent({ damage: weaponData.damage, faction: originFaction.name, originId: originEntityId, weaponData: weaponData }));
        this.ecsWorld.addComponent(entityId, new LifetimeComponent(weaponData.lifetime || 3.0));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }));
        this.ecsWorld.addComponent(entityId, new StaticDataComponent({ type: 'projectile' }));

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }
}