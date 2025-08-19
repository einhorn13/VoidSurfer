// src/ai_states/RepositioningState.js
import * as THREE from 'three';
import { IdleState } from './IdleState.js';
import { AttackingState } from './AttackingState.js';

export class RepositioningState {
    constructor(ai) {
        this.ai = ai;
        this.ecsWorld = ai.ecsWorld;
    }

    enter() {}

    update(delta) {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        const targetHealth = this.ecsWorld.getComponent(aiComponent.targetId, 'HealthComponent');

        if (!targetHealth || targetHealth.isDestroyed) {
            aiComponent.targetId = null;
            this.ai.setState(new IdleState(this.ai));
            return;
        }

        const transform = this.ecsWorld.getComponent(this.ai.entityId, 'TransformComponent');
        const physics = this.ecsWorld.getComponent(this.ai.entityId, 'PhysicsComponent');
        const targetTransform = this.ecsWorld.getComponent(aiComponent.targetId, 'TransformComponent');

        const distanceToTarget = transform.position.distanceTo(targetTransform.position);
        if (distanceToTarget < this.ai.scanRange * 0.8) {
            this.ai.setState(new AttackingState(this.ai));
            return;
        }

        const directionToTarget = new THREE.Vector3().subVectors(targetTransform.position, transform.position).normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionToTarget);
        transform.rotation.slerp(targetQuaternion, physics.turnSpeed * delta);
        physics.isAccelerating = true;
    }
}