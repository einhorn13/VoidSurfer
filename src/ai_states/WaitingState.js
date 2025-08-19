// src/ai_states/WaitingState.js
import * as THREE from 'three';
import { NavigatingState } from './NavigatingState.js';

export class WaitingState {
    constructor(ai) {
        this.ai = ai;
        this.ecsWorld = ai.ecsWorld;
    }

    enter() {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        aiComponent.stateTimer = THREE.MathUtils.randFloat(10, 20);
    }

    update(delta) {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        aiComponent.stateTimer -= delta;

        if (aiComponent.stateTimer <= 0) {
            this.ai.setState(new NavigatingState(this.ai, 'NAVIGATING_TO_EDGE'));
            return;
        }

        const physics = this.ecsWorld.getComponent(this.ai.entityId, 'PhysicsComponent');
        physics.isAccelerating = false;
    }
}