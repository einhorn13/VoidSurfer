import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

const tempVec3_1 = new THREE.Vector3();
const tempVec3_2 = new THREE.Vector3();
const tempSphere = new THREE.Sphere();

function segmentSphereIntersect(p0, p1, sphere) {
    if (!p0 || !p1 || !sphere || sphere.radius <= 0) return null;
    const segment = tempVec3_1.subVectors(p1, p0);
    const segmentLengthSq = segment.lengthSq();
    if (segmentLengthSq === 0) return null;

    const centerToStart = tempVec3_2.subVectors(p0, sphere.center);
    const b = centerToStart.dot(segment);
    const c = centerToStart.lengthSq() - sphere.radius * sphere.radius;
    
    if (c > 0 && b > 0) return null;

    const discriminant = b * b - segmentLengthSq * c;
    if (discriminant < 0) return null;

    let t = (-b - Math.sqrt(discriminant));
    if (t < 0) t = 0;
    
    t /= segmentLengthSq;
    
    if (t >= 0 && t <= 1) {
        return p0.clone().add(segment.multiplyScalar(t));
    }
    
    return null;
}

export class CollisionSystem extends System {
    constructor(world) {
        super(world);
        this.processedPairs = new Set();
    }

    update(delta) {
        this.processedPairs.clear();

        const allCollidables = this.world.query(['CollisionComponent', 'TransformComponent']);

        for (const entityId of allCollidables) {
            const health = this.world.getComponent(entityId, 'HealthComponent');
            if (health && health.state !== 'ALIVE') continue;
            
            const collision = this.world.getComponent(entityId, 'CollisionComponent');
            const nearby = serviceLocator.get('WorldManager').spatialGrid.getNearby({ entityId, collision });

            for (const other of nearby) {
                const otherId = other.entityId;
                if (entityId >= otherId) continue;
                
                const pairKey = `${entityId}-${otherId}`;
                if (this.processedPairs.has(pairKey)) continue;
                this.processedPairs.add(pairKey);

                const otherHealth = this.world.getComponent(otherId, 'HealthComponent');
                if (otherHealth && otherHealth.state !== 'ALIVE') continue;
                
                this.checkAndHandleCollision(entityId, otherId);
            }
        }
    }

    checkDetailedIntersection(collA, collB) {
        // Use detailed volumes if available, otherwise fallback to broad-phase sphere
        const volumesA = collA.volumes.length > 0 ? collA.volumes : [collA.boundingSphere];
        const volumesB = collB.volumes.length > 0 ? collB.volumes : [collB.boundingSphere];

        for (const volA of volumesA) {
            for (const volB of volumesB) {
                if (volA.intersectsSphere(volB)) {
                    return true;
                }
            }
        }
        return false;
    }

    checkAndHandleCollision(idA, idB) {
        const collisionA = this.world.getComponent(idA, 'CollisionComponent');
        const collisionB = this.world.getComponent(idB, 'CollisionComponent');
        if (!collisionA || !collisionB) return;

        // Broad-phase check first for efficiency
        if (!collisionA.boundingSphere.intersectsSphere(collisionB.boundingSphere)) {
            return;
        }

        // Now perform a detailed check
        if (!this.checkDetailedIntersection(collisionA, collisionB)) {
            return;
        }

        const isShipA = !!this.world.getComponent(idA, 'ShipComponent');
        const isCollectibleB = this.world.getComponent(idB, 'CollectibleComponent');
        if (isShipA && isCollectibleB) {
            this.world.publish('collection_collision', { collectorId: idA, collectibleId: idB });
            return;
        }

        const isShipB = !!this.world.getComponent(idB, 'ShipComponent');
        const isCollectibleA = this.world.getComponent(idA, 'CollectibleComponent');
        if (isShipB && isCollectibleA) {
            this.world.publish('collection_collision', { collectorId: idB, collectibleId: idA });
            return;
        }

        const isProjectileA = this.world.getComponent(idA, 'ProjectileComponent') || this.world.getComponent(idA, 'MissileComponent');
        const isProjectileB = this.world.getComponent(idB, 'ProjectileComponent') || this.world.getComponent(idB, 'MissileComponent');

        if (isProjectileA && isProjectileB) return;

        if (isProjectileA) {
            this.handleProjectileCollision(idA, idB);
        } else if (isProjectileB) {
            this.handleProjectileCollision(idB, idA);
        } else {
            this.handleGenericCollision(idA, idB);
        }
    }

    handleProjectileCollision(projId, targetId) {
        const projTransform = this.world.getComponent(projId, 'TransformComponent');
        const projCollision = this.world.getComponent(projId, 'CollisionComponent');
        const targetCollision = this.world.getComponent(targetId, 'CollisionComponent');
        if (!projTransform || !projCollision || !targetCollision) return;

        tempSphere.copy(targetCollision.boundingSphere);
        tempSphere.radius += projCollision.boundingSphere.radius;

        const impactPoint = segmentSphereIntersect(projTransform.prevPosition, projTransform.position, tempSphere);

        if (impactPoint) {
            const isMissile = this.world.getComponent(projId, 'MissileComponent');
            const health = this.world.getComponent(projId, 'HealthComponent');

            if (isMissile) {
                const stateComp = this.world.getComponent(projId, 'StateComponent');
                const armingState = stateComp?.states.get('ARMING');

                if (health && health.state === 'ALIVE' && armingState && armingState.timeLeft <= 0) {
                    this.world.publish('detonation', { missileId: projId, position: impactPoint });
                    health.state = 'DESTROYED';
                    return;
                }
            }
            
            this.world.publish('hit', {
                sourceId: projId,
                targetId: targetId,
                impactPoint: impactPoint
            });
        }
    }

    handleGenericCollision(idA, idB) {
        const transformA = this.world.getComponent(idA, 'TransformComponent');
        const physicsA = this.world.getComponent(idA, 'PhysicsComponent');
        const collisionA = this.world.getComponent(idA, 'CollisionComponent');
        
        const transformB = this.world.getComponent(idB, 'TransformComponent');
        const physicsB = this.world.getComponent(idB, 'PhysicsComponent');
        const collisionB = this.world.getComponent(idB, 'CollisionComponent');
        
        if (!physicsA || !physicsB || !collisionA || !collisionB) return;

        this.world.publish('hit', {
            sourceData: { type: 'collision', entityId: idA, physics: physicsA },
            targetId: idB,
            impactPoint: transformB.position.clone().lerp(transformA.position, 0.5)
        });
        
        const penetrationDepth = collisionA.boundingSphere.radius + collisionB.boundingSphere.radius - transformA.position.distanceTo(transformB.position);
        if (penetrationDepth > 0) {
            const totalInverseMass = (1 / physicsA.mass) + (1 / physicsB.mass);
            if (totalInverseMass <= 0) return;
            
            const collisionNormal = tempVec3_1.subVectors(transformA.position, transformB.position).normalize();
            
            const moveA = collisionNormal.clone().multiplyScalar(penetrationDepth * (1 / physicsA.mass) / totalInverseMass);
            const moveB = collisionNormal.clone().multiplyScalar(-penetrationDepth * (1 / physicsB.mass) / totalInverseMass);

            if (physicsA.bodyType === 'dynamic') physicsA.correctionVector.add(moveA);
            if (physicsB.bodyType === 'dynamic') physicsB.correctionVector.add(moveB);
        }
    }
}