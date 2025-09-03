// src/systems/AISensorSystem.js
import { System } from '../ecs/System.js';
import * as THREE from 'three';
import { serviceLocator } from '../ServiceLocator.js';

export class AISensorSystem extends System {
    constructor(world) {
        super(world);
        this.worldManager = serviceLocator.get('WorldManager');
        this.spatialGrid = this.worldManager.spatialGrid;
        const dataManager = serviceLocator.get('DataManager');
        const gameBalance = dataManager.getConfig('game_balance');
        this.factionRelations = gameBalance.factionRelations;
        this.standardAvoidanceConfig = gameBalance.gameplay.ai.behaviors.standard.avoidance;
        this.targetPriorities = gameBalance.gameplay.ai.targetPriorities;
        
        this.scanBox = new THREE.Box3();
        this.raycaster = new THREE.Raycaster();
        this.obstacles = [];
        this.intersectionPoint = new THREE.Vector3();
    }

    update(delta) {
        const entities = this.world.query(['AIControlledComponent', 'AIConfigComponent', 'TransformComponent', 'FactionComponent', 'HealthComponent']);
        const stationPos = this.getStationPosition();

        for (const entityId of entities) {
            const ai = this.world.getComponent(entityId, 'AIControlledComponent');
            const aiConfigComp = this.world.getComponent(entityId, 'AIConfigComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            
            this.prepareBlackboard(ai.blackboard, entityId, transform, stationPos);

            this.updateSelfState(entityId, ai.blackboard, delta);
            
            ai.blackboard.scanTimer -= delta;
            if (ai.blackboard.scanTimer <= 0) {
                const config = aiConfigComp.config;
                ai.blackboard.scanTimer = (config.scanInterval || 0.5) * (0.8 + Math.random() * 0.4);
                const nearbyShips = this.findNearbyShips(entityId, config.scanRange);
                this.updateThreatsAndTargets(entityId, ai.blackboard, nearbyShips);
                this._updateWeaponSelection(ai.blackboard);
            }
            
            this.updateTargetState(ai.blackboard, delta);
            this.updateCollisionAvoidance(entityId, ai.blackboard, delta);
        }
    }

    prepareBlackboard(blackboard, entityId, transform, stationPos) {
        blackboard.entityId = entityId;
        blackboard.knownStationPosition = stationPos;
        blackboard.selfPosition = transform.position.clone();
        blackboard.selfRotation = transform.rotation.clone();
        
        if (blackboard.scanTimer === undefined) blackboard.scanTimer = 0;
        if (blackboard.avoidanceCheckTimer === undefined) blackboard.avoidanceCheckTimer = 0;
        if (blackboard.missileCooldownLeft === undefined) blackboard.missileCooldownLeft = 0;
        if (blackboard.weaponSwitchCooldownLeft === undefined) blackboard.weaponSwitchCooldownLeft = 0;
    }
    
    updateCollisionAvoidance(entityId, blackboard, delta) {
        blackboard.avoidanceCheckTimer -= delta;
        if (blackboard.avoidanceCheckTimer > 0) return;
        
        const aiConfigComp = this.world.getComponent(entityId, 'AIConfigComponent');
        const avoidanceConfig = aiConfigComp.config.avoidance || this.standardAvoidanceConfig;
        
        blackboard.avoidanceCheckTimer = avoidanceConfig.checkInterval;

        const transform = this.world.getComponent(entityId, 'TransformComponent');
        const physics = this.world.getComponent(entityId, 'PhysicsComponent');

        const whiskers = [
            new THREE.Vector3(0, 0, -1),
            new THREE.Vector3(Math.sin(avoidanceConfig.whiskerAngle), 0, -Math.cos(avoidanceConfig.whiskerAngle)),
            new THREE.Vector3(-Math.sin(avoidanceConfig.whiskerAngle), 0, -Math.cos(avoidanceConfig.whiskerAngle)),
        ];

        let closestHit = { distance: Infinity, obstacle: null };

        this.obstacles = this.getObstacles(entityId, avoidanceConfig.whiskerLength + physics.velocity.length() * 0.5);

        for (const whisker of whiskers) {
            const direction = whisker.clone().applyQuaternion(transform.rotation);
            this.raycaster.set(transform.position, direction);
            this.raycaster.far = avoidanceConfig.whiskerLength + physics.velocity.length() * 0.5;

            for (const obstacle of this.obstacles) {
                if (this.raycaster.ray.intersectSphere(obstacle.sphere, this.intersectionPoint)) {
                    const distance = transform.position.distanceToSquared(this.intersectionPoint);
                    if (distance < closestHit.distance) {
                        closestHit.distance = distance;
                        closestHit.obstacle = obstacle;
                    }
                }
            }
        }

        if (closestHit.obstacle) {
            const obstacleCenter = closestHit.obstacle.sphere.center;
            const avoidanceDir = new THREE.Vector3().subVectors(transform.position, obstacleCenter);
            
            if (avoidanceDir.lengthSq() < 0.001) {
                blackboard.avoidanceVector = new THREE.Vector3().randomDirection();
            } else {
                blackboard.avoidanceVector = avoidanceDir.normalize();
            }
        } else {
            blackboard.avoidanceVector = null;
        }
    }

    getObstacles(selfId, radius) {
        const obstacles = [];
        const selfTransform = this.world.getComponent(selfId, 'TransformComponent');
        const querySize = new THREE.Vector3(1, 1, 1).multiplyScalar(radius * 2);
        this.scanBox.setFromCenterAndSize(selfTransform.position, querySize);
        
        const nearbyEntities = this.spatialGrid.getNearby({ boundingBox: this.scanBox });

        for (const { entityId } of nearbyEntities) {
            if (entityId === selfId) continue;
            
            const health = this.world.getComponent(entityId, 'HealthComponent');
            if(health && health.state !== 'ALIVE') continue;

            const staticData = this.world.getComponent(entityId, 'StaticDataComponent');
            const type = staticData?.data.type;
            if (['asteroid', 'station', 'planet', 'sun', 'ship'].includes(type)) {
                const collision = this.world.getComponent(entityId, 'CollisionComponent');
                if (collision) {
                    obstacles.push({ id: entityId, sphere: collision.boundingSphere });
                }
            }
        }
        return obstacles;
    }
    
    getStationPosition() {
        const stationId = this.worldManager.stationEntityId;
        if (stationId !== null) {
            const stationTransform = this.world.getComponent(stationId, 'TransformComponent');
            return stationTransform ? stationTransform.position : null;
        }
        return null;
    }

    updateSelfState(entityId, blackboard, delta) {
        const health = this.world.getComponent(entityId, 'HealthComponent');
        const oldHull = blackboard.lastHullValue || health.hull.current;
        const damageTaken = oldHull - health.hull.current;
        
        blackboard.recentDamage = (blackboard.recentDamage || 0) * (1 - delta) + damageTaken;
        blackboard.lastHullValue = health.hull.current;
        blackboard.hullRatio = health.hull.current / health.hull.max;
        blackboard.shieldRatio = health.shield.current / health.shield.max;
        blackboard.missileCooldownLeft = Math.max(0, blackboard.missileCooldownLeft - delta);
        blackboard.weaponSwitchCooldownLeft = Math.max(0, blackboard.weaponSwitchCooldownLeft - delta);

        if (!blackboard.smoothedAvoidanceVector) {
            blackboard.smoothedAvoidanceVector = new THREE.Vector3();
        }

        const targetAvoidance = blackboard.avoidanceVector || new THREE.Vector3(0, 0, 0);
        blackboard.smoothedAvoidanceVector.lerp(targetAvoidance, delta * 5.0);
    }

    updateTargetState(blackboard, delta) {
        if (!blackboard.targetId) {
            blackboard.targetPosition = null;
            blackboard.targetVelocity = null;
            blackboard.distanceToTarget = Infinity;
            blackboard.timeOnCurrentTarget = 0;
            return;
        }

        const targetHealth = this.world.getComponent(blackboard.targetId, 'HealthComponent');
        if (!targetHealth || targetHealth.state !== 'ALIVE') {
            blackboard.targetId = null;
            return;
        }

        const selfTransform = this.world.getComponent(blackboard.entityId, 'TransformComponent');
        const targetTransform = this.world.getComponent(blackboard.targetId, 'TransformComponent');
        const targetPhysics = this.world.getComponent(blackboard.targetId, 'PhysicsComponent');
        
        blackboard.targetPosition = targetTransform.position.clone();
        blackboard.targetVelocity = targetPhysics ? targetPhysics.velocity.clone() : new THREE.Vector3();
        blackboard.distanceToTarget = selfTransform.position.distanceTo(targetTransform.position);
        blackboard.timeOnCurrentTarget += delta;
    }
    
    findNearbyShips(selfId, scanRange) {
        const transform = this.world.getComponent(selfId, 'TransformComponent');
        const scanSize = new THREE.Vector3(1, 1, 1).multiplyScalar(scanRange * 2);
        this.scanBox.setFromCenterAndSize(transform.position, scanSize);
        
        return this.spatialGrid.getNearby({ boundingBox: this.scanBox }, 'ship')
            .filter(other => other.entityId !== selfId)
            .map(other => other.entityId);
    }
    
    updateThreatsAndTargets(selfId, blackboard, nearbyShipIds) {
        const selfFaction = this.world.getComponent(selfId, 'FactionComponent');
        const selfTransform = this.world.getComponent(selfId, 'TransformComponent');
        const hostileFactions = this.factionRelations[selfFaction.name] || [];

        let bestTarget = { id: null, score: Infinity };
        
        if (this.world.hasEntity(blackboard.targetId) && this.world.getComponent(blackboard.targetId, 'HealthComponent').state === 'ALIVE') {
            bestTarget.id = blackboard.targetId;
            bestTarget.score = this.scoreTarget(blackboard.targetId, selfTransform, true);
        }

        for (const otherId of nearbyShipIds) {
            if (otherId === blackboard.targetId) continue;

            const otherFaction = this.world.getComponent(otherId, 'FactionComponent');
            if (!hostileFactions.includes(otherFaction.name)) continue;

            const score = this.scoreTarget(otherId, selfTransform, false);
            if (score < bestTarget.score) {
                bestTarget = { id: otherId, score };
            }
        }
        
        if (bestTarget.id !== blackboard.targetId) {
            blackboard.targetId = bestTarget.id;
            blackboard.timeOnCurrentTarget = 0;
        }
    }

    _updateWeaponSelection(blackboard) {
        if (!blackboard.targetId || blackboard.weaponSwitchCooldownLeft > 0) return;

        const { entityId, distanceToTarget, config } = blackboard;
        const hardpoints = this.world.getComponent(entityId, 'HardpointComponent');
        const ammo = this.world.getComponent(entityId, 'AmmoComponent');
        if (!hardpoints) return;

        let bestIndex = -1;
        let bestScore = -1;

        hardpoints.hardpoints.forEach((hp, index) => {
            let score = 0;
            const weapon = hp.weapon;
            
            // Score missiles if in range and available
            if (weapon.type === 'HOMING' && blackboard.missileCooldownLeft <= 0) {
                const hasAmmo = (ammo.ammo.get(weapon.ammoType) || 0) > 0;
                if (hasAmmo && distanceToTarget > config.missileMinRange && distanceToTarget < config.missileMaxRange) {
                    score = 100; // High priority for missiles
                }
            }
            // Score primary weapons
            else if (weapon.category !== 'HEAVY') {
                // Check if optimalRange is defined for this AI behavior
                if (config.optimalRange && distanceToTarget > config.optimalRange[0] && distanceToTarget < config.optimalRange[1]) {
                    score = 50; // In optimal range
                } else {
                    score = 25; // Out of optimal range, but still usable
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });

        if (bestIndex !== -1 && blackboard.selectedWeaponIndex !== bestIndex) {
            blackboard.selectedWeaponIndex = bestIndex;
            blackboard.weaponSwitchCooldownLeft = config.targetSwitchCooldown * 0.25; // Use a fraction of switch cooldown
        }
    }

    scoreTarget(targetId, selfTransform, isCurrentTarget) {
        const targetTransform = this.world.getComponent(targetId, 'TransformComponent');
        if (!targetTransform) return Infinity;
        
        const distance = selfTransform.position.distanceTo(targetTransform.position);
        
        const isPlayer = !!this.world.getComponent(targetId, 'PlayerControlledComponent');
        const playerBonus = isPlayer ? this.targetPriorities.playerBonus : 0;
        
        const currentTargetBonus = isCurrentTarget ? this.targetPriorities.currentTargetBonus : 0;
        
        return distance - playerBonus - currentTargetBonus;
    }
}