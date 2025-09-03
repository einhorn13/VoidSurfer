// src/components/CommandQueueComponent.js
import { Component } from '../ecs/Component.js';

/**
 * A component that holds a list of commands to be executed for an entity in the current frame.
 * This will be used by both the player's input system and the AI behavior system.
 */
export class CommandQueueComponent extends Component {
    constructor() {
        super();
        this.queue = [];
    }
}