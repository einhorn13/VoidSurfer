import { Component } from '../ecs/Component.js';

/**
 * Stores the static configuration for an AI's behavior.
 * This data is typically loaded from game balance files.
 */
export class AIConfigComponent extends Component {
    constructor(config) {
        super();
        this.config = config || {};

        // Ensure navReachedThreshold exists for trader AI
        if (!this.config.navReachedThreshold) {
            this.config.navReachedThreshold = 100.0;
        }
    }
}