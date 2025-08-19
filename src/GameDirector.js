// src/GameDirector.js
import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';
import { DynamicSpawner } from './DynamicSpawner.js';

export class GameDirector {
    constructor() {
        this.dataManager = serviceLocator.get('DataManager');
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.ecsWorld = serviceLocator.get('ECSWorld');

        this.spawner = new DynamicSpawner(this, this.dataManager.getConfig('spawn_config'));
    }

    init() {
        this.spawnInitialEnemies();
        this.spawnInitialAsteroids();
    }

    spawnInitialAsteroids() {
        const asteroidTypes = ['ROCK', 'IRON'];
        asteroidTypes.forEach(typeId => {
            this.entityFactory.environment.registerInstancedMeshType(typeId);
        });

        for (let i = 0; i < 30; i++) {
            const pos = new THREE.Vector3(
                THREE.MathUtils.randFloatSpread(1000),
                THREE.MathUtils.randFloatSpread(1000),
                THREE.MathUtils.randFloatSpread(1000)
            ).add(new THREE.Vector3(0, 0, -600));
            const type = Math.random() > 0.3 ? 'ROCK' : 'IRON';
            
            this.entityFactory.environment.createAsteroid(type, pos);
        }
    }

    update(delta) {
        // Player respawn and item collection logic has been moved to their respective systems.
        // GameDirector now only handles dynamic spawning.
        const playerIds = this.ecsWorld.query(['PlayerControlledComponent']);
        const playerEntityId = playerIds.length > 0 ? playerIds[0] : null;

        if (playerEntityId) {
            const playerHealth = this.ecsWorld.getComponent(playerEntityId, 'HealthComponent');
            if (playerHealth && !playerHealth.isDestroyed) {
                this.spawner.update(delta, playerEntityId);
            }
        }
    }

    spawnPlayer() {
        const oldPlayerIds = this.ecsWorld.query(['PlayerControlledComponent']);
        for (const id of oldPlayerIds) {
            const health = this.ecsWorld.getComponent(id, 'HealthComponent');
            if (health) health.isDestroyed = true;
        }

        const playerState = this.gameStateManager.playerState;
        const options = {
            isPlayer: true,
            position: new THREE.Vector3(0, 0, 0),
            currentHull: playerState.hull,
            cargo: playerState.cargo,
            ammo: playerState.ammo
        };
        const playerEntityId = this.entityFactory.ship.createShip(playerState.shipId, options);
        return playerEntityId;
    }

    spawnInitialEnemies() {
        const spawnDetails = [
            { id: 'PIRATE_RAIDER', dist: [600, 800] },
            { id: 'SCRAPHEAP', dist: [700, 900] }
        ];

        spawnDetails.forEach(detail => {
            const spawnDirection = new THREE.Vector3(
                Math.random() - 0.5,
                (Math.random() - 0.5) * 0.5,
                Math.random() - 0.5
            ).normalize();
            
            const spawnDistance = THREE.MathUtils.randFloat(detail.dist[0], detail.dist[1]);
            const position = spawnDirection.multiplyScalar(spawnDistance);
            
            this.createShip(detail.id, { position });
        });
    }

    createShip(shipId, options) {
        const shipEntityId = this.entityFactory.ship.createShip(shipId, options);
        return shipEntityId;
    }
    
    spawnItem(itemId, quantity, position) {
        this.entityFactory.item.createItem(itemId, quantity, position);
    }
}