// src/components/ProjectileComponent.js
import { Component } from '../ecs/Component.js';

/**
 * A marker component for straight-flying projectiles like plasma bolts.
 */
export class ProjectileComponent extends Component {
    constructor({ damage, faction, originId, weaponData }) {
        super();
        this.damage = damage;
        this.faction = faction;
        this.originId = originId;
        this.weaponData = weaponData;
        this.pierceLeft = weaponData.pierce || 0;
    }
}