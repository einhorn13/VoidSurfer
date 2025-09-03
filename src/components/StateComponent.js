// src/components/StateComponent.js
import { Component } from '../ecs/Component.js';

/**
 * A generic component for storing various states and their associated data.
 * Used for cooldowns, AI objectives, temporary statuses, etc.
 * Example state: { type: 'drifting', duration: 7.0, timeLeft: 7.0 }
 */
export class StateComponent extends Component {
    constructor() {
        super();
        this.states = new Map();
    }
}