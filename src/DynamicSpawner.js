// src/DynamicSpawner.js
import * as THREE from 'three';

export class DynamicSpawner {
    constructor(worldManager, spawnConfig) {
        this.worldManager = worldManager;
        this.config = spawnConfig; // Receive config from WorldManager
        if (!this.config) {
            throw new Error("Spawn config not provided to DynamicSpawner!");
        }

        this.spawnTimer = this.config.spawnInterval;
        this.factionCounts = {};
    }

    update(playerPos, allShips) {
        // --- Despawn distant ships ---
        allShips.forEach(ship => {
            if (ship.isPlayer) return;
            const distance = ship.mesh.position.distanceTo(playerPos);
            if (distance > this.config.despawnDistance) {
                this.worldManager.despawnShip(ship);
            }
        });

        // --- Spawn new ships ---
        this.spawnTimer -= 1/60; // Assuming 60fps, delta would be better
        if (this.spawnTimer > 0) return;
        this.spawnTimer = this.config.spawnInterval;

        this.recountFactions(allShips);

        for (const [faction, limit] of Object.entries(this.config.factionLimits)) {
            const currentCount = this.factionCounts[faction] || 0;
            if (currentCount < limit) {
                this.spawnShipForFaction(faction, playerPos);
                break; // Spawn one ship per interval to avoid bursts
            }
        }
    }

    recountFactions(allShips) {
        this.factionCounts = {};
        allShips.forEach(ship => {
            if (ship.isPlayer) return;
            this.factionCounts[ship.faction] = (this.factionCounts[ship.faction] || 0) + 1;
        });
    }

    spawnShipForFaction(faction, playerPos) {
        const possibleShips = this.config.shipsByFaction[faction];
        if (!possibleShips || possibleShips.length === 0) return;

        const shipId = possibleShips[Math.floor(Math.random() * possibleShips.length)];

        const spawnDirection = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();
        const spawnDistance = THREE.MathUtils.randFloat(this.config.spawnDistance.min, this.config.spawnDistance.max);
        const position = playerPos.clone().add(spawnDirection.multiplyScalar(spawnDistance));

        const options = { position, faction };
        
        this.worldManager.createShip(shipId, options);
    }
}