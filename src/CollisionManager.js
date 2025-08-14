import * as THREE from 'three';
import { Ship } from './Ship.js';
import { Asteroid } from './Asteroid.js';

/**
 * Manages all physical collision detection and resolution in the world.
 */
export class CollisionManager {
    constructor(spatialGrid, effectsManager) {
        this.spatialGrid = spatialGrid;
        this.effectsManager = effectsManager;
        this.processedPairs = new Set();
    }

    /**
     * The main update loop for the collision system.
     * @param {Array} collidables - All dynamic objects (ships, asteroids, station).
     * @param {Array} celestialBodies - All static, large bodies (planets, sun).
     */
    update(collidables, celestialBodies) {
        this._checkCelestialCollisions(collidables, celestialBodies);
        this._checkDynamicCollisions(collidables);
    }

    /**
     * Checks for collisions between ships and massive celestial bodies (instant death).
     */
    _checkCelestialCollisions(collidables, celestialBodies) {
        // Only ships can be destroyed this way
        const ships = collidables.filter(c => c instanceof Ship);

        for (const ship of ships) {
            if (ship.isDestroyed) continue;
            for (const body of celestialBodies) {
                if (ship.boundingSphere.intersectsSphere(body.boundingSphere)) {
                    ship.takeDamage(99999); // Instant destruction
                    this.effectsManager.createExplosion(ship.mesh.position);
                    break; 
                }
            }
        }
    }
    
    /**
     * Checks for collisions between dynamic objects using the spatial grid.
     */
    _checkDynamicCollisions(collidables) {
        this.processedPairs.clear();

        for (const objA of collidables) {
            if (objA.isDestroyed) continue;

            const nearbyObjects = this.spatialGrid.getNearby(objA);
            for (const objB of nearbyObjects) {
                if (objB.isDestroyed || objA === objB) continue;

                const pairKey = objA.mesh.uuid < objB.mesh.uuid ? `${objA.mesh.uuid}-${objB.mesh.uuid}` : `${objB.mesh.uuid}-${objA.mesh.uuid}`;
                if (this.processedPairs.has(pairKey)) continue;
                
                if (objA.boundingSphere.intersectsSphere(objB.boundingSphere)) {
                    this._resolveCollision(objA, objB);
                    this.processedPairs.add(pairKey);
                }
            }
        }
    }

    /**
     * Resolves a collision between two dynamic objects, applying damage and physics impulse.
     */
    _resolveCollision(objA, objB) {
        // We only care about collisions involving at least one ship for damage/physics
        if (!(objA instanceof Ship || objB instanceof Ship)) return;
        
        const relativeVelocity = objA.velocity.clone().sub(objB.velocity);
        const impactSpeed = relativeVelocity.length();
        if (impactSpeed < 1.0) return; // Ignore very low speed impacts

        // Damage proportional to impact speed
        const damage = Math.min(impactSpeed, 200); // Cap damage
        if (objA.takeDamage) objA.takeDamage(damage);
        if (objB.takeDamage) objB.takeDamage(damage);

        // Physics response (simplified impulse)
        const collisionNormal = objA.mesh.position.clone().sub(objB.mesh.position).normalize();
        
        const totalMass = objA.currentMass + objB.currentMass;
        const impulseMagnitude = impactSpeed * 0.8; // Bounciness factor

        const impulseA = collisionNormal.clone().multiplyScalar(impulseMagnitude * (objB.currentMass / totalMass));
        const impulseB = collisionNormal.clone().multiplyScalar(-impulseMagnitude * (objA.currentMass / totalMass));
        
        objA.velocity.add(impulseA);
        objB.velocity.add(impulseB);

        // Slightly move objects apart to prevent sticking
        const penetrationDepth = objA.boundingSphere.radius + objB.boundingSphere.radius - objA.mesh.position.distanceTo(objB.mesh.position);
        if (penetrationDepth > 0) {
            const moveA = collisionNormal.clone().multiplyScalar(penetrationDepth * (objB.currentMass / totalMass));
            const moveB = collisionNormal.clone().multiplyScalar(-penetrationDepth * (objA.currentMass / totalMass));
            objA.mesh.position.add(moveA);
            objB.mesh.position.add(moveB);
        }
    }
}