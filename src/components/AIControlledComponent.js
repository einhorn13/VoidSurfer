// src/components/AIControlledComponent.js
// src/components/AIControlledComponent.js
import { Component } from '../ecs/Component.js';

export class AIControlledComponent extends Component {
    constructor(behavior) {
        super();
        this.behaviorName = behavior; // e.g., 'standard', 'gunship'
        this.behaviorTree = null; // Will be built by AIBehaviorSystem

        // The "Blackboard" - a central place for this AI's dynamic data
        this.blackboard = {
            // Static context (set once)
            entityId: null,
            world: null,
            config: null,
            services: {},
            
            // Dynamic context (updated by systems)
            commandQueue: [], // The BT will push commands here
            targetId: null,
            selfPosition: null,
            targetPosition: null,
            hullRatio: 1,
            
            // BT internal state
            patrolTargetPosition: null,
            selectedWeaponIndex: 0,
            weaponSwitchCooldownLeft: 0,
            previousAimPoint: null,
        };
    }
}