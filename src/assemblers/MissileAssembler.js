import * as THREE from 'three';
import { BaseAssembler } from './BaseAssembler.js';
import { MeshFactory } from '../MeshFactory.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { CollisionComponent } from '../components/CollisionComponent.js';
import { MissileComponent } from '../components/MissileComponent.js';
import { LifetimeComponent } from '../components/LifetimeComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { HomingComponent } from '../components/HomingComponent.js';
import { StaticDataComponent } from '../components/StaticDataComponent.js';
import { FactionComponent } from '../components/FactionComponent.js';
import { StateComponent } from '../components/StateComponent.js';

export class MissileAssembler extends BaseAssembler {
    createMissile(originEntityId, hardpoint, targetEntityId) {
        const originTransform = this.ecsWorld.getComponent(originEntityId, 'TransformComponent');
        const originPhysics = this.ecsWorld.getComponent(originEntityId, 'PhysicsComponent');
        const originFaction = this.ecsWorld.getComponent(originEntityId, 'FactionComponent');

        if (!originTransform || !originPhysics || !originFaction) {
            console.error(`Cannot create missile: origin entity ${originEntityId} is missing required components.`);
            return null;
        }

        const weaponData = hardpoint.weapon;
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0xffdddd, emissive: 0xff2222 }));

        const offset = new THREE.Vector3().fromArray(hardpoint.pos || [0, 0, 0]);
        const startPosition = offset.applyQuaternion(originTransform.rotation).add(originTransform.position);
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(originTransform.rotation);
        const initialVelocity = originPhysics.velocity.clone();
        const missileThrust = forward.clone().multiplyScalar(30);
        const velocity = initialVelocity.add(missileThrust);

        const missileConfig = this.dataManager.getConfig('game_balance').gameplay.missiles;

        const collision = new CollisionComponent();
        collision.boundingSphere.radius = weaponData.collisionRadius || 2.0;
        
        const state = new StateComponent();
        state.states.set('ARMING', { timeLeft: missileConfig.armingTime });

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position: startPosition, rotation: originTransform.rotation.clone() }))
            .with(new PhysicsComponent({ velocity, mass: 1, bodyType: 'dynamic' }))
            .with(new RenderComponent(mesh))
            .with(collision)
            .with(new MissileComponent({ damage: weaponData.damage, faction: originFaction.name, originId: originEntityId, weaponData: weaponData }))
            .with(state)
            .with(new HomingComponent({ targetId: targetEntityId, turnRate: 1.5, maxSpeed: 80 }))
            .with(new LifetimeComponent(weaponData.lifetime || 15.0))
            .with(new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }))
            .with(new StaticDataComponent({ type: 'missile' }))
            .build();
        
        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }
}