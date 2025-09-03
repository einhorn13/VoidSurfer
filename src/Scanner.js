import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { navigationService } from './NavigationService.js';

const TARGET_CYCLE_CONE_ANGLE = 0.26;

export class Scanner {
    constructor(spatialGrid, camera) {
        this.camera = camera;
        this.ecsWorld = null; // Lazy loaded
        this.dataManager = serviceLocator.get('DataManager');
        this.spatialGrid = spatialGrid;

        this.targets = [];
        this.playerShipId = null;
        this.playerFaction = null;
        this.allTargetableIds = [];

        this.queryBox = new THREE.Box3();
        this.factionRelations = this.dataManager.getConfig('game_balance').factionRelations;
        this.sensorConfig = this.dataManager.getConfig('game_balance').playerSensors;
        
        this.updateInterval = 0.1;
        this.timeSinceLastUpdate = 0;
    }

    _getECSWorld() {
        if (!this.ecsWorld) {
            this.ecsWorld = serviceLocator.get('ECSWorld');
        }
        return this.ecsWorld;
    }

    update(delta, playerShipId, allTargetableIds) {
        this.timeSinceLastUpdate += delta;
        if (this.timeSinceLastUpdate < this.updateInterval) {
            return;
        }
        this.timeSinceLastUpdate = 0;

        this.playerShipId = playerShipId;
        this.allTargetableIds = allTargetableIds;

        this.targets = [];
        if (playerShipId === null) return;
        
        const ecs = this._getECSWorld();

        const playerTransform = ecs.getComponent(playerShipId, 'TransformComponent');
        const playerFactionComp = ecs.getComponent(playerShipId, 'FactionComponent');
        if (!playerTransform || !playerFactionComp) return;
        this.playerFaction = playerFactionComp.name;
        
        allTargetableIds.forEach(targetId => {
            const health = ecs.getComponent(targetId, 'HealthComponent');
            if (health && health.state !== 'ALIVE') return;

            const targetTransform = ecs.getComponent(targetId, 'TransformComponent');
            const staticData = ecs.getComponent(targetId, 'StaticDataComponent');
            if (!targetTransform || !staticData || targetId === playerShipId) return;
            
            const distance = playerTransform.position.distanceTo(targetTransform.position);
            const type = staticData.data.type;
            const factionComp = ecs.getComponent(targetId, 'FactionComponent');
            const faction = factionComp ? factionComp.name : 'NEUTRAL';

            const isLargeObject = ['station', 'planet', 'sun'].includes(type);
            
            // Large objects are always visible, other objects only within sensor range.
            if (isLargeObject || distance <= this.sensorConfig.maxVisibilityRange) {
                 this.targets.push({ entityId: targetId, distance, faction, type });
            }
        });
        
        this.targets.sort((a, b) => a.distance - b.distance);

        const navTarget = navigationService.getTarget();
        if (navTarget && navTarget.type === 'entity') {
            const navTargetHealth = ecs.getComponent(navTarget.entityId, 'HealthComponent');
            if (navTargetHealth && navTargetHealth.state !== 'ALIVE') {
                navigationService.clearTarget();
            }
        }
    }
    
    setNavTarget(targetId) {
        const ecs = this._getECSWorld();
        const staticData = ecs.getComponent(targetId, 'StaticDataComponent');
        const transform = ecs.getComponent(targetId, 'TransformComponent');
        if (staticData && transform) {
            navigationService.setTarget({
                type: 'entity',
                entityId: targetId,
                position: transform.position,
                name: staticData.data.name || `Entity ${targetId}`
            });
        }
    }

    deselectTarget() {
        navigationService.clearTarget();
    }

    cycleTarget() {
        if (this.playerShipId === null || !this.camera) return;

        const ecs = this._getECSWorld();
        const playerTransform = ecs.getComponent(this.playerShipId, 'TransformComponent');
        if (!playerTransform) return;
        
        const potentialTargetIds = this.targets
            .filter(t => {
                const isLargeObject = ['station', 'planet', 'sun'].includes(t.type);
                const isTargetableSmallObject = ['ship', 'salvage', 'item', 'asteroid'].includes(t.type);
                // Allow targeting large objects regardless of range, and small objects within range.
                return isLargeObject || (isTargetableSmallObject && t.distance <= this.sensorConfig.maxVisibilityRange);
            })
            .map(t => t.entityId);

        if (potentialTargetIds.length === 0) {
            this.deselectTarget();
            return;
        }

        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(playerTransform.rotation);
        const scoredTargets = [];

        for (const targetId of potentialTargetIds) {
            if (targetId === this.playerShipId) continue;

            const targetTransform = ecs.getComponent(targetId, 'TransformComponent');
            if (!targetTransform) continue;
            
            const directionToTarget = new THREE.Vector3().subVectors(targetTransform.position, playerTransform.position).normalize();
            
            const angle = forwardVector.angleTo(directionToTarget);
            if (angle > TARGET_CYCLE_CONE_ANGLE) {
                continue;
            }
            
            const screenPos = targetTransform.position.clone().project(this.camera);
            if (screenPos.z > 1) continue;

            const score = Math.sqrt(screenPos.x**2 + screenPos.y**2);
            scoredTargets.push({ targetId, score });
        }

        if (scoredTargets.length === 0) {
            this.deselectTarget();
            return;
        }

        scoredTargets.sort((a, b) => a.score - b.score);

        const sortedTargetIds = scoredTargets.map(st => st.targetId);
        
        const currentTarget = navigationService.getTarget();
        let currentIndex = -1;
        if (currentTarget && currentTarget.type === 'entity') {
            currentIndex = sortedTargetIds.findIndex(id => id === currentTarget.entityId);
        }

        const nextIndex = (currentIndex + 1) % sortedTargetIds.length;
        this.setNavTarget(sortedTargetIds[nextIndex]);
    }

    findBestTargetInRadius(entityId, scanRange) {
        const ecs = this._getECSWorld();
        const transform = ecs.getComponent(entityId, 'TransformComponent');
        const factionComp = ecs.getComponent(entityId, 'FactionComponent');
        if (!transform || !factionComp) return null;

        const hostileFactions = this.factionRelations[factionComp.name] || [];
        if (hostileFactions.length === 0) return null;

        let closestTargetId = null;
        let minDistanceSq = scanRange * scanRange;

        const size = new THREE.Vector3(1, 1, 1).multiplyScalar(scanRange * 2);
        this.queryBox.setFromCenterAndSize(transform.position, size);
        const nearbyShips = this.spatialGrid.getNearby({ boundingBox: this.queryBox }, 'ship');

        for (const { entityId: otherId } of nearbyShips) {
            if (otherId === entityId) continue;
            
            const otherHealth = ecs.getComponent(otherId, 'HealthComponent');
            if (!otherHealth || otherHealth.state !== 'ALIVE') continue;

            const otherFaction = ecs.getComponent(otherId, 'FactionComponent');
            if (!otherFaction || !hostileFactions.includes(otherFaction.name)) continue;
            
            const otherTransform = ecs.getComponent(otherId, 'TransformComponent');
            const distanceSq = transform.position.distanceToSquared(otherTransform.position);

            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestTargetId = otherId;
            }
        }
        return closestTargetId;
    }
    
    getTargetInfo(targetId) {
        const ecs = this._getECSWorld();
        if (targetId === null || this.playerShipId === null || !ecs.hasEntity(this.playerShipId)) {
            return null;
        }
        
        const targetStatic = ecs.getComponent(targetId, 'StaticDataComponent');
        const targetTransform = ecs.getComponent(targetId, 'TransformComponent');
        const playerTransform = ecs.getComponent(this.playerShipId, 'TransformComponent');

        if (!targetStatic || !targetTransform || !playerTransform) return null;

        const targetFactionComp = ecs.getComponent(targetId, 'FactionComponent');
        const faction = targetFactionComp?.name || "NEUTRAL";
        
        let relation = 'neutral';
        if (this.factionRelations[this.playerFaction]?.includes(faction)) {
            relation = 'hostile';
        } else if (faction === this.playerFaction) {
            relation = 'friendly';
        }
        
        const targetPhysics = ecs.getComponent(targetId, 'PhysicsComponent');
        const speed = targetPhysics ? Math.round(targetPhysics.velocity.length()) : 0;

        return {
            name: targetStatic.data.name || 'Unknown',
            distance: playerTransform.position.distanceTo(targetTransform.position),
            speed: speed,
            faction: faction,
            relation: relation,
            health: ecs.getComponent(targetId, 'HealthComponent')
        };
    }
}