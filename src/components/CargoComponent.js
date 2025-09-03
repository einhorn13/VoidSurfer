// src/components/CargoComponent.js
import { Component } from '../ecs/Component.js';

export class CargoComponent extends Component {
    constructor({ capacity, items, currentMass }) {
        super();
        this.capacity = capacity || 0;
        // items is expected to be an object like { IRON_ORE: 10 }
        this.items = new Map(Object.entries(items || {}));
        // OPTIMIZATION: Store current mass of items in cargo hold
        this.currentMass = currentMass || 0;
    }
}