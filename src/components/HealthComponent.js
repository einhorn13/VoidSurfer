// src/components/HealthComponent.js
import { Component } from '../ecs/Component.js';

export class HealthComponent extends Component {
    constructor({ hull, maxHull, shield, maxShield, shieldRegenRate }) {
        super();
        this.hull = { current: hull, max: maxHull };
        this.shield = { current: shield, max: maxShield, regenRate: shieldRegenRate };
        this.isDestroyed = false;
        this.dropsHandled = false;
        this.isCleanedUp = false;
        
        // New field to track damage sources
        this.damageLog = new Map();
    }
}