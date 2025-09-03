import { Component } from '../ecs/Component.js';

export class HealthComponent extends Component {
    constructor({ hull, maxHull, shield, maxShield, shieldRegenRate }) {
        super();
        this.hull = { current: hull, max: maxHull };
        this.shield = { current: shield, max: maxShield, regenRate: shieldRegenRate };
        
        // State machine for entity lifecycle: ALIVE -> DESTROYED -> DROPS_HANDLED -> CLEANUP_PENDING
        this.state = 'ALIVE';
        
        this.damageLog = new Map();
    }
}