import { Component } from '../ecs/Component.js';

/**
 * Stores modules (weapons, shields, engines) that are owned by the player but not currently equipped.
 */
export class PlayerInventoryComponent extends Component {
    constructor() {
        super();
        this.weapons = new Map();
        this.shields = new Map();
        this.engines = new Map();
    }
}