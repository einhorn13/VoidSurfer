// src/systems/PlayerRespawnSystem.js
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { eventBus } from '../EventBus.js';

const RESPAWN_DELAY = 5.0;

export class PlayerRespawnSystem extends System {
    constructor(world) {
        super(world);
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.isRespawning = false;
        this.respawnTimer = -1;
    }

    update(delta) {
        const playerIds = this.world.query(['PlayerControlledComponent']);
        const playerEntityId = playerIds.length > 0 ? playerIds[0] : null;

        if (playerEntityId) {
            const health = this.world.getComponent(playerEntityId, 'HealthComponent');
            if (health && health.isDestroyed && !this.isRespawning) {
                this.isRespawning = true;
                this.respawnTimer = RESPAWN_DELAY;

                // CRITICAL FIX: Pass the entity ID, not the entity object.
                this.gameStateManager.updatePlayerShipState(playerEntityId);
            }
        }

        if (this.isRespawning) {
            this.respawnTimer -= delta;
            if (this.respawnTimer <= 0) {
                eventBus.emit('player_respawn_request');
                this.isRespawning = false;
                this.respawnTimer = -1;
            }
        }
    }
}