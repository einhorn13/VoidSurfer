// src/commands/AICommand.js
import * as THREE from 'three';
import { ShipCommand } from './ShipCommand.js';
import { serviceLocator } from '../ServiceLocator.js';

const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempRay = new THREE.Ray();
const losCheckObstacles = [];
const losQueryBox = new THREE.Box3();
const randomSpreadVector = new THREE.Vector3();

function isVector3Invalid(v) {
    return !isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z);
}

/**
 * A command for AI to turn towards a specific world position.
 */
export class TurnTowardsCommand extends ShipCommand {
    constructor(targetPosition) {
        super();
        this.targetPosition = targetPosition;
    }

    execute(entityId, world, services) {
        const transform = world.getComponent(entityId, 'TransformComponent');
        const physics = world.getComponent(entityId, 'PhysicsComponent');
        if (!transform || !physics || !this.targetPosition) return;
        
        if (isVector3Invalid(this.targetPosition)) {
            console.error(`TurnTowardsCommand received invalid targetPosition for entity ${entityId}`, this.targetPosition);
            return;
        }

        const direction = new THREE.Vector3().subVectors(this.targetPosition, transform.position);

        if (direction.lengthSq() < 0.0001) {
            return;
        }
        
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.normalize());
        const maxTurnAngle = physics.turnSpeed * services.delta;
        
        transform.rotation.rotateTowards(targetQuaternion, maxTurnAngle);
    }
}

/**
 * A high-level command for AI to fly towards a position while avoiding obstacles.
 */
export class FlyTowardsCommand extends ShipCommand {
    constructor(targetPosition) {
        super();
        this.targetPosition = targetPosition;
    }

    execute(entityId, world, services) {
        const ai = world.getComponent(entityId, 'AIControlledComponent');
        const transform = world.getComponent(entityId, 'TransformComponent');
        if (!ai || !transform) return;

        let finalTargetPoint = this.targetPosition.clone();
        
        const avoidance = ai.blackboard.smoothedAvoidanceVector;
        if (avoidance && avoidance.lengthSq() > 0.01) {
            const avoidanceInfluence = Math.min(avoidance.length(), 0.9);
            const avoidancePoint = transform.position.clone().add(avoidance.multiplyScalar(200));
            finalTargetPoint.lerp(avoidancePoint, avoidanceInfluence);
            
            if (isVector3Invalid(finalTargetPoint)) {
                finalTargetPoint.copy(this.targetPosition);
            }
        }
        
        new TurnTowardsCommand(finalTargetPoint).execute(entityId, world, services);
    }
}

/**
 * A command specifically for AI to fire a weapon at a given hardpoint index.
 */
export class FireWeaponAtIndexCommand extends ShipCommand {
    constructor(hardpointIndex) {
        super();
        this.hardpointIndex = hardpointIndex;
    }

    execute(entityId, world, services) {
        world.publish('fire_weapon_request', {
            originId: entityId,
            hardpointIndex: this.hardpointIndex
        });
    }
}

export class EngageTargetCommand extends ShipCommand {
    constructor(targetId) {
        super();
        this.targetId = targetId;
    }

    execute(entityId, world, services) {
        const ai = world.getComponent(entityId, 'AIControlledComponent');
        const aiConfigComp = world.getComponent(entityId, 'AIConfigComponent');
        const transform = world.getComponent(entityId, 'TransformComponent');
        
        if (!ai || !aiConfigComp || !transform) return;
        
        const targetTransform = world.getComponent(this.targetId, 'TransformComponent');
        if (!targetTransform) return;
        
        const aimPoint = this._getAimingPosition(entityId, this.targetId, world, aiConfigComp);
        
        new TurnTowardsCommand(aimPoint).execute(entityId, world, services);

        if (this._hasLineOfSight(world, transform.position, aimPoint, entityId, this.targetId)) {
            const angleToTarget = this._getAngleToTarget(transform, aimPoint);
            
            // Probabilistic firing
            const fireTolerance = aiConfigComp.config.firingAngleTolerance;
            if (angleToTarget < fireTolerance) {
                const fireProbability = Math.max(0, 1.0 - (angleToTarget / fireTolerance));

                if (Math.random() < fireProbability && ai.blackboard.timeOnCurrentTarget >= (aiConfigComp.config.aimingDelay || 0.5)) {
                    this._fireWeapons(entityId, world, services);
                }
            }
        }
    }
    
    _fireWeapons(entityId, world, services) {
        const hardpointsComp = world.getComponent(entityId, 'HardpointComponent');
        const aiComp = world.getComponent(entityId, 'AIControlledComponent');
        if (!hardpointsComp || !aiComp) return;

        const selectedIndex = aiComp.blackboard.selectedWeaponIndex || 0;
        const hardpoint = hardpointsComp.hardpoints[selectedIndex];

        if (hardpoint && hardpoint.cooldownLeft <= 0) {
            world.publish('fire_weapon_request', { 
                originId: entityId,
                hardpointIndex: selectedIndex
            });
        }
    }

    _getAimingPosition(selfId, targetId, world, aiConfigComp) {
        const selfTransform = world.getComponent(selfId, 'TransformComponent');
        const targetTransform = world.getComponent(targetId, 'TransformComponent');
        if (!selfTransform || !targetTransform) return targetTransform.position;

        const hardpoints = world.getComponent(selfId, 'HardpointComponent');
        const primaryWeapon = hardpoints?.hardpoints.find(hp => hp.weapon.category !== 'HEAVY');
        const weaponData = primaryWeapon?.weapon;
        
        let aimPoint;

        if (!weaponData || weaponData.hitScan) {
            aimPoint = targetTransform.position.clone();
        } else {
            const projectileSpeed = weaponData.speed;
            if (!projectileSpeed || projectileSpeed <= 0) {
                aimPoint = targetTransform.position.clone();
            } else {
                const selfPhysics = world.getComponent(selfId, 'PhysicsComponent');
                const targetPhysics = world.getComponent(targetId, 'PhysicsComponent');
                const targetVelocity = targetPhysics ? targetPhysics.velocity : new THREE.Vector3();
                const relativePosition = new THREE.Vector3().subVectors(targetTransform.position, selfTransform.position);
                const distance = relativePosition.length();
                const maxRange = projectileSpeed * (weaponData.lifetime || 3.0);
                const accuracyFalloff = Math.max(0, 1.0 - (distance / (maxRange * 0.6)));
                const effectiveTargetVelocity = targetVelocity.clone().multiplyScalar(accuracyFalloff);
                const relativeVelocity = new THREE.Vector3().subVectors(effectiveTargetVelocity, selfPhysics.velocity);
                const a = relativeVelocity.dot(relativeVelocity) - projectileSpeed * projectileSpeed;
                const b = 2 * relativeVelocity.dot(relativePosition);
                const c = relativePosition.dot(relativePosition);

                if (Math.abs(a) < 0.001) {
                    aimPoint = targetTransform.position.clone();
                } else {
                    const discriminant = b * b - 4 * a * c;
                    if (discriminant < 0) {
                        aimPoint = targetTransform.position.clone();
                    } else {
                        const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
                        const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
                        const positiveTimes = [t1, t2].filter(t => t > 0);
                        
                        if (positiveTimes.length === 0) {
                            aimPoint = targetTransform.position.clone();
                        } else {
                            let timeToImpact = Math.min(...positiveTimes);
                            const maxPredictionTime = (weaponData.lifetime || 5.0) * 0.75;
                            timeToImpact = Math.min(timeToImpact, maxPredictionTime);
                            aimPoint = new THREE.Vector3().addVectors(targetTransform.position, effectiveTargetVelocity.multiplyScalar(timeToImpact));
                        }
                    }
                }
            }
        }

        if (isVector3Invalid(aimPoint)) {
            console.error(`_getAimingPosition produced invalid vector for entity ${selfId}. Fallback to target position.`);
            aimPoint = targetTransform.position.clone();
        }

        const spreadFactor = aiConfigComp.config.aimingSpreadFactor || 0.0;
        if (spreadFactor > 0) {
            const distance = selfTransform.position.distanceTo(targetTransform.position);
            const spreadMagnitude = distance * spreadFactor;
            randomSpreadVector.randomDirection().multiplyScalar(spreadMagnitude * Math.random());
            aimPoint.add(randomSpreadVector);
        }

        return aimPoint;
    }
    
    _getAngleToTarget(selfTransform, targetPosition) {
        const forward = tempVector.set(0, 0, -1).applyQuaternion(selfTransform.rotation);
        const directionToTarget = tempVector.subVectors(targetPosition, selfTransform.position).normalize();
        return forward.angleTo(directionToTarget);
    }
    
    _hasLineOfSight(world, start, end, selfId, targetId) {
        const direction = tempVector.subVectors(end, start);
        const distance = direction.length();
        if (distance < 0.001) return true;
        
        direction.normalize();
        tempRay.set(start, direction);
        
        const spatialGrid = serviceLocator.get('WorldManager').spatialGrid;
        
        losCheckObstacles.length = 0;
        const queryCenter = start.clone().lerp(end, 0.5);
        const boxSize = new THREE.Vector3(Math.abs(end.x - start.x), Math.abs(end.y - start.y), Math.abs(end.z - start.z)).addScalar(10);
        losQueryBox.setFromCenterAndSize(queryCenter, boxSize);
        const nearby = spatialGrid.getNearby({ boundingBox: losQueryBox });

        for (const { entityId } of nearby) {
            if (entityId === selfId || entityId === targetId) continue;
            
            const staticData = world.getComponent(entityId, 'StaticDataComponent');
            const type = staticData?.data.type;
            
            if (type === 'ship') {
                const selfFaction = world.getComponent(selfId, 'FactionComponent');
                const otherFaction = world.getComponent(entityId, 'FactionComponent');
                if (selfFaction && otherFaction && selfFaction.name === otherFaction.name) {
                    continue; // Ignore friendly ships for LoS checks
                }
            }
            
            if (type === 'ship' || type === 'asteroid' || type === 'station' || type === 'planet' || type === 'sun') {
                losCheckObstacles.push(world.getComponent(entityId, 'CollisionComponent'));
            }
        }
        
        for (const collision of losCheckObstacles) {
            if (collision && tempRay.intersectSphere(collision.boundingSphere, tempVector)) {
                if (start.distanceToSquared(tempVector) < distance * distance) {
                    return false;
                }
            }
        }
        
        return true;
    }
}