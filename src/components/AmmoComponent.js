// src/components/AmmoComponent.js
import { Component } from '../ecs/Component.js';

export class AmmoComponent extends Component {
    constructor(ammoData) {
        super();
        // ammoData is expected to be an object like { PROJECTILE: 500, MISSILE: 10 }
        this.ammo = new Map(Object.entries(ammoData || {}));
    }
}