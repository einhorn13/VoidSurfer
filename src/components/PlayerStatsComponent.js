// src/components/PlayerStatsComponent.js
import { Component } from '../ecs/Component.js';

/**
 * Stores player-specific, non-physical data like credits.
 * This makes the ECS the single source of truth for player state.
 */
export class PlayerStatsComponent extends Component {
    constructor(credits = 0) {
        super();
        this.credits = credits;
    }
}