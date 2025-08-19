// src/components/LifetimeComponent.js
import { Component } from '../ecs/Component.js';

export class LifetimeComponent extends Component {
    constructor(duration) {
        super();
        this.timeLeft = duration;
    }
}