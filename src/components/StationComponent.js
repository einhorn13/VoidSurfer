// src/components/StationComponent.js
import { Component } from '../ecs/Component.js';

export class StationComponent extends Component {
    constructor({ dockingRadius, maxDockingSpeed }) {
        super();
        this.dockingRadius = dockingRadius;
        this.maxDockingSpeed = maxDockingSpeed;
    }
}