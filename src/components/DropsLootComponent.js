// src/components/DropsLootComponent.js
import { Component } from '../ecs/Component.js';

export class DropsLootComponent extends Component {
    constructor(dropsData) {
        super();
        // dropsData is expected to be an object like:
        // { credits: [10, 50], items: [{ itemId: 'IRON_ORE', quantity: [1, 5], chance: 0.8 }] }
        this.drops = dropsData;
    }
}