// src/ai_states/FleeingState.js
import * as THREE from 'three';
import { IdleState } from './IdleState.js';
import { RepositioningState } from './RepositioningState.js';
import { NavigatingState } from './NavigatingState.js';

export class FleeingState {
    constructor(ai) {
        this.ai = ai;
        this.ecsWorld = ai.ecsWorld;
    }

    enter() {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        aiComponent.stateTimer = this.ai.behavior === 'trader' ? 15.0 : 10.0;
    }

    update(delta) {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        aiComponent.stateTimer -= delta;

        const targetTransform = this.ecsWorld.getComponent(aiComponent.targetId, 'TransformComponent');
        if (!targetTransform) {
            this.transitionToIdleOrNav();
            return;
        }

        const health = this.ecsWorld.getComponent(this.ai.entityId, 'HealthComponent');
        if (aiComponent.stateTimer <= 0) {
            if (this.ai.behavior !== 'trader' && health.shield.current / health.shield.max > this.ai.reengageShieldThreshold) {
                this.ai.setState(new RepositioningState(this.ai));
            } else {
                aiComponent.targetId = null;
                this.transitionToIdleOrNav();
            }
            return;
        }

        const transform = this.ecsWorld.getComponent(this.ai.entityId, 'TransformComponent');
        const physics = this.ecsWorld.getComponent(this.ai.entityId, 'PhysicsComponent');

        const directionAway = new THREE.Vector3().subVectors(transform.position, targetTransform.position).normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionAway);
        
        transform.rotation.slerp(targetQuaternion, physics.turnSpeed * delta);
        physics.isAccelerating = true;
    }

    transitionToIdleOrNav() {
        if (this.ai.behavior === 'trader') {
            this.ai.setState(new NavigatingState(this.ai, 'NAVIGATING_TO_STATION'));
        } else {
            this.ai.setState(new IdleState(this.ai));
        }
    }
}