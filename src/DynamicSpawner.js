import * as THREE from 'three';

export class DynamicSpawner {
    constructor(worldManager, spawnConfig) {
        this.worldManager = worldManager;
        this.ecsWorld = worldManager.ecsWorld; // Get access to ECS world
        this.config = spawnConfig;
        if (!this.config) {
            throw new Error("Spawn config not provided to DynamicSpawner!");
        }

        this.spawnTimer = this.config.spawnInterval;
        this.factionCounts = {};
    }

    update(delta, playerEntityId) {
        if (playerEntityId === null) return;
        
        const playerTransform = this.ecsWorld.getComponent(playerEntityId, 'TransformComponent');
        if (!playerTransform) return;
        const playerPos = playerTransform.position;
        
        const allShipIds = this.ecsWorld.query(['ShipTag']);

        allShipIds.forEach(shipId => {
            const isPlayer = this.ecsWorld.getComponent(shipId, 'PlayerControlledComponent');
            if (isPlayer) return;

            const shipTransform = this.ecsWorld.getComponent(shipId, 'TransformComponent');
            if (!shipTransform) return;

            const distance = shipTransform.position.distanceTo(playerPos);
            if (distance > this.config.despawnDistance) {
                // Mark for cleanup instead of direct removal
                const health = this.ecsWorld.getComponent(shipId, 'HealthComponent');
                if (health) health.isDestroyed = true;
            }
        });

        this.spawnTimer -= delta;
        if (this.spawnTimer > 0) return;
        this.spawnTimer = this.config.spawnInterval;

        this.recountFactions(allShipIds);

        for (const [faction, limit] of Object.entries(this.config.factionLimits)) {
            const currentCount = this.factionCounts[faction] || 0;
            if (currentCount < limit) {
                this.spawnShipForFaction(faction, playerTransform);
                break; 
            }
        }
    }

    recountFactions(allShipIds) {
        this.factionCounts = {};
        allShipIds.forEach(shipId => {
            const isPlayer = this.ecsWorld.getComponent(shipId, 'PlayerControlledComponent');
            if (isPlayer) return;

            const factionComp = this.ecsWorld.getComponent(shipId, 'FactionComponent');
            const faction = factionComp.name;
            this.factionCounts[faction] = (this.factionCounts[faction] || 0) + 1;
        });
    }

    spawnShipForFaction(faction, playerTransform) {
        const possibleShips = this.config.shipsByFaction[faction];
        if (!possibleShips || possibleShips.length === 0) return;

        const shipId = possibleShips[Math.floor(Math.random() * possibleShips.length)];

        const spawnDirection = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();

        const spawnDistance = THREE.MathUtils.randFloat(this.config.spawnDistance.min, this.config.spawnDistance.max);
        const position = playerTransform.position.clone().add(spawnDirection.multiplyScalar(spawnDistance));

        const options = { position, faction };
        
        this.worldManager.createShip(shipId, options);
    }
}