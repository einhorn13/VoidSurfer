import * as THREE from 'three';

const SPAWN_SAFETY_RADIUS = 50; // Min distance from other objects
const MAX_SPAWN_ATTEMPTS = 10;

export class DynamicSpawner {
    constructor(gameDirector, spawnConfig) {
        this.gameDirector = gameDirector;
        this.ecsWorld = gameDirector.ecsWorld;
        this.config = spawnConfig;
        
        this.spawnCheckTimer = this.config.spawnInterval;
        this.globalSpawnCooldown = 0;

        // Helper objects to avoid reallocation
        this.queryBox = new THREE.Box3();
        this.queryBoxSize = new THREE.Vector3();
    }

    update(delta, playerEntityId) {
        if (playerEntityId === null) return;
        
        this.globalSpawnCooldown = Math.max(0, this.globalSpawnCooldown - delta);
        this.spawnCheckTimer -= delta;
        if (this.spawnCheckTimer > 0) return;
        this.spawnCheckTimer = this.config.spawnInterval;

        const playerTransform = this.ecsWorld.getComponent(playerEntityId, 'TransformComponent');
        if (!playerTransform) return;
        
        this.handleDeactivation(playerTransform.position);
        
        if (this.globalSpawnCooldown > 0) return;

        const currentZone = this.gameDirector.getCurrentZone(playerTransform.position);
        if (!currentZone || !currentZone.encounterPool) return;

        const localCounts = this.getLocalFactionCounts(playerTransform.position);

        for (const [faction, limit] of Object.entries(this.config.localFactionLimits)) {
            if ((localCounts.get(faction) || 0) < limit) {
                this.trySpawnEncounter(currentZone, playerTransform);
                return;
            }
        }
    }

    handleDeactivation(playerPosition) {
        const allShipIds = this.ecsWorld.query(['ShipComponent']);

        allShipIds.forEach(shipId => {
            if (this.ecsWorld.getComponent(shipId, 'PlayerControlledComponent')) return;

            const shipTransform = this.ecsWorld.getComponent(shipId, 'TransformComponent');
            const render = this.ecsWorld.getComponent(shipId, 'RenderComponent');
            const health = this.ecsWorld.getComponent(shipId, 'HealthComponent');

            if (!shipTransform || !render || !render.isVisible || !health || health.state !== 'ALIVE') return;

            if (shipTransform.position.distanceTo(playerPosition) > this.config.despawnDistance) {
                this.gameDirector.deactivateNpc(shipId);
            }
        });
    }

    getLocalFactionCounts(playerPosition) {
        const counts = new Map();
        const nearbyShips = this.ecsWorld.query(['ShipComponent', 'TransformComponent', 'FactionComponent', 'RenderComponent']);
        
        for (const shipId of nearbyShips) {
            const transform = this.ecsWorld.getComponent(shipId, 'TransformComponent');
            const render = this.ecsWorld.getComponent(shipId, 'RenderComponent');
            if (render.isVisible && transform.position.distanceTo(playerPosition) < this.config.despawnDistance) {
                const faction = this.ecsWorld.getComponent(shipId, 'FactionComponent').name;
                counts.set(faction, (counts.get(faction) || 0) + 1);
            }
        }
        return counts;
    }
    
    isSpawnPointSafe(position, radius) {
        const spatialGrid = this.gameDirector.worldManager.spatialGrid;
        this.queryBoxSize.set(radius * 2, radius * 2, radius * 2);
        this.queryBox.setFromCenterAndSize(position, this.queryBoxSize);
        
        const nearby = spatialGrid.getNearby({ boundingBox: this.queryBox });

        // If any object is found in the vicinity, the point is not safe.
        return nearby.length === 0;
    }

    trySpawnEncounter(zone, playerTransform) {
        const zoneThreat = this.gameDirector.zoneThreatLevels.get(zone.id) || 0;
        
        const possibleEncounters = zone.encounterPool.filter(enc => {
            const squadData = this.config.squads[enc.squadId];
            return squadData && (squadData.threat || 0) <= zoneThreat;
        });

        if (possibleEncounters.length === 0) return;

        const totalWeight = possibleEncounters.reduce((sum, enc) => sum + enc.weight, 0);
        let random = Math.random() * totalWeight;
        const selectedEncounter = possibleEncounters.find(enc => (random -= enc.weight) < 0);

        if (!selectedEncounter) return;

        let spawnPosition = null;
        for (let i = 0; i < MAX_SPAWN_ATTEMPTS; i++) {
            const potentialPosition = this.calculateSpawnPosition(playerTransform.position);
            if (this.isSpawnPointSafe(potentialPosition, SPAWN_SAFETY_RADIUS)) {
                spawnPosition = potentialPosition;
                break;
            }
        }

        if (!spawnPosition) {
            console.warn("DynamicSpawner: Could not find a safe spawn point after several attempts.");
            return;
        }

        const squadData = this.config.squads[selectedEncounter.squadId];
        
        let objective = { type: selectedEncounter.objective, targetPosition: null };
        if (objective.type === 'TRADE_RUN_STATION') {
            const station = this.ecsWorld.getComponent(this.gameDirector.worldManager.stationEntityId, 'TransformComponent');
            objective.targetPosition = station?.position;
        } else if (objective.type === 'PATROL_AREA' || objective.type === 'HUNT_IN_AREA') {
            objective.targetPosition = spawnPosition;
        }

        this.gameDirector.reactivateOrSpawnSquad(squadData.ships, spawnPosition, objective);
        
        this.globalSpawnCooldown = THREE.MathUtils.randFloat(15, 20);
    }
    
    calculateSpawnPosition(playerPosition) {
        const spawnDirection = new THREE.Vector3(
            Math.random() - 0.5, (Math.random() - 0.5) * 0.5, Math.random() - 0.5
        ).normalize();
        
        const spawnDistance = THREE.MathUtils.randFloat(this.config.spawnDistance.min, this.config.spawnDistance.max);
        return playerPosition.clone().add(spawnDirection.multiplyScalar(spawnDistance));
    }
}