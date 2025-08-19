// src/components/AIControlledComponent.js
import { Component } from '../ecs/Component.js';

export class AIControlledComponent extends Component {
    constructor(behavior) {
        super();
        this.behavior = behavior;
        this.currentState = null;
        this.targetId = null;
        // Timers and other AI state data can be stored here
        this.scanTimer = 0;
        this.stateTimer = 0;
    }
}