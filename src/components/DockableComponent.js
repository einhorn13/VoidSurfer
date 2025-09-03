import { Component } from '../ecs/Component.js';

export class DockableComponent extends Component {
    constructor({ dockingRadius, maxDockingSpeed }) {
        super();
        this.dockingRadius = dockingRadius;
        this.maxDockingSpeed = maxDockingSpeed;
    }
}