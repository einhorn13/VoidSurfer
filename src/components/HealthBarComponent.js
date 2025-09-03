// src/components/HealthBarComponent.js
import { Component } from '../ecs/Component.js';

export class HealthBarComponent extends Component {
    constructor({ sprite, canvas, context }) {
        super();
        this.sprite = sprite;
        this.canvas = canvas;
        this.context = context;
        this.isVisible = true;

        // OPTIMIZATION: Flags to prevent unnecessary redraws
        this.needsUpdate = true;
        this.lastKnownHull = -1;
        this.lastKnownShield = -1;
    }
}