// src/components/EnergyComponent.js
import { Component } from '../ecs/Component.js';

export class EnergyComponent extends Component {
    constructor({ current, max, regenRate }) {
        super();
        this.current = current;
        this.max = max;
        this.regenRate = regenRate;
    }
}