// src/ai_states/AttackingState.js
import * as THREE from 'three';
import { IdleState } from './IdleState.js';
import { FleeingState } from './FleeingState.js';

export class AttackingState {
    constructor(ai) {
        this.ai = ai;
        this.ecsWorld = ai.ecsWorld;
        // Re-usable vector to avoid allocations in the loop
        this.hardpointWorldPosition = new THREE.Vector3();
    }

    enter() {
        this.ai.attackStyleTimer = THREE.MathUtils.randFloat(5, 10);
        this.ai.attackStyle = 'TACTICAL';
    }

    update(delta) {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        const targetExists = this.ecsWorld.hasEntity(aiComponent.targetId);
        const targetHealth = this.ecsWorld.getComponent(aiComponent.targetId, 'HealthComponent');

        if (!targetExists || !targetHealth || targetHealth.isDestroyed) {
            aiComponent.targetId = null;
            this.ai.setState(new IdleState(this.ai));
            return;
        }

        const health = this.ecsWorld.getComponent(this.ai.entityId, 'HealthComponent');
        if (health.hull.current / health.hull.max < this.ai.fleeHealthThreshold) {
            this.ai.setState(new FleeingState(this.ai));
            return;
        }

        this.updateAttackStyle(delta);
        this.handleMovementAndTargeting(delta, aiComponent.targetId);
        this.fireWeapons(aiComponent.targetId);
    }

    updateAttackStyle(delta) {
        this.ai.attackStyleTimer -= delta;
        if (this.ai.attackStyleTimer <= 0) {
            if (this.ai.attackStyle === 'TACTICAL') {
                if (Math.random() < 0.3) {
                    this.ai.attackStyle = 'BERSERK';
                    this.ai.attackStyleTimer = THREE.MathUtils.randFloat(4, 7);
                } else {
                    this.ai.attackStyleTimer = THREE.MathUtils.randFloat(5, 10);
                }
            } else {
                this.ai.attackStyle = 'TACTICAL';
                this.ai.attackStyleTimer = THREE.MathUtils.randFloat(8, 15);
            }
        }
    }

    handleMovementAndTargeting(delta, targetId) {
        const transform = this.ecsWorld.getComponent(this.ai.entityId, 'TransformComponent');
        const physics = this.ecsWorld.getComponent(this.ai.entityId, 'PhysicsComponent');
        const targetTransform = this.ecsWorld.getComponent(targetId, 'TransformComponent');
        if(!transform || !physics || !targetTransform) return;
        
        const directionToTarget = new THREE.Vector3().subVectors(targetTransform.position, transform.position);
        directionToTarget.normalize();

        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionToTarget);
        transform.rotation.slerp(targetQuaternion, physics.turnSpeed * delta * 1.5);

        physics.isAccelerating = true;
    }

    fireWeapons(targetId) {
        const transform = this.ecsWorld.getComponent(this.ai.entityId, 'TransformComponent');
        const energy = this.ecsWorld.getComponent(this.ai.entityId, 'EnergyComponent');
        const ammo = this.ecsWorld.getComponent(this.ai.entityId, 'AmmoComponent');
        const hardpoints = this.ecsWorld.getComponent(this.ai.entityId, 'HardpointComponent');
        const targetTransform = this.ecsWorld.getComponent(targetId, 'TransformComponent');

        if(!transform || !energy || !ammo || !hardpoints || !targetTransform) return;

        const distance = transform.position.distanceTo(targetTransform.position);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.rotation);
        
        this.ai.lastMissileTime += this.ai.delta;

        for (const hardpoint of hardpoints.hardpoints) {
            const weapon = hardpoint.weapon;
            if (!weapon) continue;

            // FIX: Re-check resource availability before each shot within the same frame.
            const canAfford = energy.current >= weapon.energyCost &&
                              (!weapon.ammoType || (ammo.ammo.get(weapon.ammoType) || 0) >= weapon.ammoCost);

            if (!canAfford) continue;

            const offset = new THREE.Vector3().fromArray(hardpoint.pos || [0, 0, 0]);
            this.hardpointWorldPosition.copy(transform.position).add(offset.applyQuaternion(transform.rotation));
            const directionFromHardpoint = new THREE.Vector3().subVectors(targetTransform.position, this.hardpointWorldPosition).normalize();
            
            const isAimed = forward.dot(directionFromHardpoint) > 0.98;
            if (!isAimed) continue;

            let shouldFire = false;
            switch (weapon.type) {
                case 'HOMING':
                    if (distance > this.ai.missileMinRange && distance < this.ai.missileMaxRange && this.ai.lastMissileTime > this.ai.missileCooldown) {
                        shouldFire = true;
                        this.ai.lastMissileTime = 0;
                    }
                    break;
                default:
                    if (distance < this.ai.attackRange * 1.5) {
                        shouldFire = true;
                    }
                    break;
            }

            if (shouldFire) {
                energy.current -= weapon.energyCost;
                if (weapon.ammoType) {
                    ammo.ammo.set(weapon.ammoType, (ammo.ammo.get(weapon.ammoType) || 0) - weapon.ammoCost);
                }
                
                this.ecsWorld.publish('fire_weapon', {
                    originId: this.ai.entityId,
                    hardpoint: hardpoint,
                    targetId: targetId
                });
            }
        }
    }
}