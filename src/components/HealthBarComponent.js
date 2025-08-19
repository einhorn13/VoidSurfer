// src/components/HealthBarComponent.js
import { Component } from '../ecs/Component.js';

export class HealthBarComponent extends Component {
    constructor({ sprite, canvas, context }) {
        super();
        this.sprite = sprite;
        this.canvas = canvas;
        this.context = context;
        this.isVisible = true;
    }
}