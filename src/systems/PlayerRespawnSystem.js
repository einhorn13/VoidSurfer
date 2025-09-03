import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { eventBus } from '../EventBus.js';

export class PlayerRespawnSystem extends System {
    constructor(world) {
        super(world);
        this.gameStateManager = serviceLocator.get('GameStateManager');
        const dataManager = serviceLocator.get('DataManager');
        this.respawnDelay = dataManager.getConfig('game_balance').playerRespawn.delay;

        this.isRespawning = false;
        this.respawnTimer = -1;
    }

    update(delta) {
        const playerIds = this.world.query(['PlayerControlledComponent']);
        const playerEntityId = playerIds.length > 0 ? playerIds[0] : null;

        if (playerEntityId) {
            const health = this.world.getComponent(playerEntityId, 'HealthComponent');
            if (health && health.state !== 'ALIVE' && !this.isRespawning) {
                this.isRespawning = true;
                this.respawnTimer = this.respawnDelay;
                this.gameStateManager.saveState();
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