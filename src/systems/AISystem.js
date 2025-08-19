// src/systems/AISystem.js
import { System } from '../ecs/System.js';
import * as THREE from 'three';
import { serviceLocator } from '../ServiceLocator.js';
import { IdleState } from '../ai_states/IdleState.js';
import { NavigatingState } from '../ai_states/NavigatingState.js';

const FACTION_RELATIONS = {
    'PIRATE_FACTION': ['PLAYER_FACTION', 'CIVILIAN_FACTION']
};

export class AISystem extends System {
    constructor(world) {
        super(world);
        this.entityAssembler = serviceLocator.get('EntityFactory');
        this.worldManager = serviceLocator.get('WorldManager');
        this.spatialGrid = this.worldManager.spatialGrid;
        
        const balanceConfig = serviceLocator.get('DataManager').getConfig('game_balance').gameplay.ai;
        this.aiParams = {
            attackRange: balanceConfig.attackRange,
            scanRange: balanceConfig.scanRange,
            fleeHealthThreshold: balanceConfig.fleeHealthThreshold,
            reengageShieldThreshold: balanceConfig.reengageShieldThreshold,
            missileCooldown: balanceConfig.missileCooldown,
            missileMinRange: balanceConfig.missileMinRange,
            missileMaxRange: balanceConfig.missileMaxRange,
            navReachedThreshold: 100.0,
            scanInterval: 2.0
        };

        this.aiObjectCache = new Map();
        this.scanBox = new THREE.Box3(); // Re-usable bounding box for queries
    }

    getAIObject(entityId) {
        if (!this.aiObjectCache.has(entityId)) {
            const aiObject = {
                entityId: entityId,
                ecsWorld: this.world,
                entityAssembler: this.entityAssembler,
                worldManager: this.worldManager,
                ...this.aiParams,
                lastMissileTime: 0,
                attackStyle: 'TACTICAL',
                attackStyleTimer: 0,
                navTargetPosition: null,

                setState: (newState) => {
                    const aiComponent = this.world.getComponent(entityId, 'AIControlledComponent');
                    if (aiComponent) {
                        aiComponent.currentState = newState;
                        if (aiComponent.currentState.enter) {
                            aiComponent.currentState.enter();
                        }
                    }
                },
                findClosestHostile: () => this.findClosestHostile(entityId),
                findClosestThreat: () => this.findClosestThreat(entityId)
            };
            this.aiObjectCache.set(entityId, aiObject);
        }
        return this.aiObjectCache.get(entityId);
    }

    update(delta) {
        const entities = this.world.query(['AIControlledComponent', 'HealthComponent', 'PhysicsComponent']);
        
        for (const entityId of entities) {
            const physics = this.world.getComponent(entityId, 'PhysicsComponent');
            physics.isAccelerating = false; // AI controls this flag fully for its entities

            const health = this.world.getComponent(entityId, 'HealthComponent');
            if (health.isDestroyed) {
                if(this.aiObjectCache.has(entityId)) { this.aiObjectCache.delete(entityId); }
                continue;
            }

            const aiComponent = this.world.getComponent(entityId, 'AIControlledComponent');
            const aiObject = this.getAIObject(entityId);
            aiObject.delta = delta;

            if (!aiComponent.currentState) { this.initializeBehavior(aiObject, aiComponent.behavior); }
            
            aiComponent.currentState.update(delta);
        }
    }
    
    initializeBehavior(aiObject, behavior) {
        if (behavior === 'trader') {
            aiObject.setState(new NavigatingState(aiObject));
        } else {
            aiObject.setState(new IdleState(aiObject));
        }
    }

    _getNearbyShips(selfEntityId) {
        const transform = this.world.getComponent(selfEntityId, 'TransformComponent');
        if (!transform) return [];

        const scanSize = new THREE.Vector3(1, 1, 1).multiplyScalar(this.aiParams.scanRange * 2);
        this.scanBox.setFromCenterAndSize(transform.position, scanSize);

        const nearbyEntities = this.spatialGrid.getNearby({ boundingBox: this.scanBox });
        
        return nearbyEntities.filter(other => {
            if (other.entityId === selfEntityId) return false;
            return this.world.getComponent(other.entityId, 'ShipTag');
        }).map(other => other.entityId);
    }

    findClosestHostile(selfEntityId) {
        const faction = this.world.getComponent(selfEntityId, 'FactionComponent');
        const transform = this.world.getComponent(selfEntityId, 'TransformComponent');
        if (!faction || !transform) return null;

        const hostileFactions = FACTION_RELATIONS[faction.name];
        if (!hostileFactions) return null;

        let closestTargetId = null;
        let minDistance = this.aiParams.scanRange;

        const potentialTargetIds = this._getNearbyShips(selfEntityId);

        for (const targetId of potentialTargetIds) {
            const targetFaction = this.world.getComponent(targetId, 'FactionComponent');
            const targetHealth = this.world.getComponent(targetId, 'HealthComponent');

            if (!targetFaction || !targetHealth || targetHealth.isDestroyed || !hostileFactions.includes(targetFaction.name)) continue;

            const targetTransform = this.world.getComponent(targetId, 'TransformComponent');
            const distance = transform.position.distanceTo(targetTransform.position);
            if (distance < minDistance) {
                minDistance = distance;
                closestTargetId = targetId;
            }
        }
        return closestTargetId;
    }

    findClosestThreat(selfEntityId) {
        const faction = this.world.getComponent(selfEntityId, 'FactionComponent');
        const transform = this.world.getComponent(selfEntityId, 'TransformComponent');
        if (!faction || !transform) return null;

        let closestThreatId = null;
        let minDistance = this.aiParams.scanRange;
        
        const potentialThreatIds = this._getNearbyShips(selfEntityId);

        for (const targetId of potentialThreatIds) {
            const targetFaction = this.world.getComponent(targetId, 'FactionComponent');
            if (!targetFaction || targetFaction.name === faction.name) continue;

            const targetHealth = this.world.getComponent(targetId, 'HealthComponent');
            if (!targetHealth || targetHealth.isDestroyed) continue;

            const enemyHostileFactions = FACTION_RELATIONS[targetFaction.name];
            if (enemyHostileFactions && enemyHostileFactions.includes(faction.name)) {
                const targetTransform = this.world.getComponent(targetId, 'TransformComponent');
                const distance = transform.position.distanceTo(targetTransform.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestThreatId = targetId;
                }
            }
        }
        return closestThreatId;
    }
}