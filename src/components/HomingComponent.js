// src/components/HomingComponent.js
import { Component } from '../ecs/Component.js';

export class HomingComponent extends Component {
    constructor({ targetId, turnRate, maxSpeed }) {
        super();
        this.targetId = targetId;
        this.turnRate = turnRate;
        this.maxSpeed = maxSpeed;
        this.notificationSent = false;
    }
}