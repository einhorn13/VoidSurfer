// src/ai_states/NavigatingState.js
import * as THREE from 'three';
import { IdleState } from './IdleState.js';
import { FleeingState } from './FleeingState.js';
import { WaitingState } from './WaitingState.js';

export class NavigatingState {
    constructor(ai, mode = 'NAVIGATING_TO_STATION') {
        this.ai = ai;
        this.ecsWorld = ai.ecsWorld;
        this.mode = mode; // 'NAVIGATING_TO_STATION' or 'NAVIGATING_TO_EDGE'
    }

    enter() {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        aiComponent.scanTimer = Math.random() * this.ai.scanInterval;
        this.setNavTarget();
    }

    update(delta) {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        aiComponent.scanTimer -= delta;

        if (aiComponent.scanTimer <= 0) {
            const threatId = this.ai.findClosestThreat();
            if (threatId !== null) {
                aiComponent.targetId = threatId;
                this.ai.setState(new FleeingState(this.ai));
                return;
            }
            aiComponent.scanTimer = this.ai.scanInterval;
        }

        if (!this.ai.navTargetPosition) {
            this.ai.setState(new IdleState(this.ai));
            return;
        }

        const transform = this.ecsWorld.getComponent(this.ai.entityId, 'TransformComponent');
        const physics = this.ecsWorld.getComponent(this.ai.entityId, 'PhysicsComponent');

        const distance = transform.position.distanceTo(this.ai.navTargetPosition);
        if (distance < this.ai.navReachedThreshold) {
            if (this.mode === 'NAVIGATING_TO_STATION') {
                this.ai.setState(new WaitingState(this.ai));
            } else { // NAVIGATING_TO_EDGE
                this.ai.setState(new NavigatingState(this.ai, 'NAVIGATING_TO_STATION'));
            }
            return;
        }
        
        const directionToTarget = new THREE.Vector3().subVectors(this.ai.navTargetPosition, transform.position).normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionToTarget);
        transform.rotation.slerp(targetQuaternion, physics.turnSpeed * delta * 0.5);
        physics.isAccelerating = true;
    }

    setNavTarget() {
        if (this.mode === 'NAVIGATING_TO_STATION') {
            const stationId = this.ai.worldManager.stationEntityId;
            if (stationId !== null) {
                const stationTransform = this.ai.ecsWorld.getComponent(stationId, 'TransformComponent');
                if (stationTransform) {
                    this.ai.navTargetPosition = stationTransform.position.clone();
                }
            }
        } else { // NAVIGATING_TO_EDGE
            const direction = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() * 0.2 - 0.1,
                Math.random() - 0.5
            ).normalize();
            this.ai.navTargetPosition = direction.multiplyScalar(3000);
        }
    }
}