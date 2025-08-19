// src/components/ShieldImpactEffectComponent.js
import { Component } from '../ecs/Component.js';

export class ShieldImpactEffectComponent extends Component {
    constructor(targetEntityId) {
        super();
        this.targetEntityId = targetEntityId; // The ID of the entity this effect is attached to
        this.time = 0;
        this.duration = 1.5; // Must match LifetimeComponent duration
    }
}