// src/ai_states/IdleState.js
import { AttackingState } from './AttackingState.js';
import { FleeingState } from './FleeingState.js';

export class IdleState {
    constructor(ai) {
        this.ai = ai;
        this.ecsWorld = ai.ecsWorld;
    }

    enter() {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        aiComponent.scanTimer = Math.random() * this.ai.scanInterval;
    }

    update(delta) {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');
        aiComponent.scanTimer -= delta;
        if (aiComponent.scanTimer <= 0) {
            this.scanForTargets();
            aiComponent.scanTimer = this.ai.scanInterval;
        }
        
        const physics = this.ecsWorld.getComponent(this.ai.entityId, 'PhysicsComponent');
        physics.isAccelerating = false;
    }
    
    scanForTargets() {
        const aiComponent = this.ecsWorld.getComponent(this.ai.entityId, 'AIControlledComponent');

        if (this.ai.behavior === 'trader') {
            const threatId = this.ai.findClosestThreat();
            if (threatId !== null) {
                aiComponent.targetId = threatId;
                this.ai.setState(new FleeingState(this.ai));
            }
        } else {
            const targetId = this.ai.findClosestHostile();
            if (targetId !== null) {
                aiComponent.targetId = targetId;
                this.ai.setState(new AttackingState(this.ai));
            }
        }
    }
}