// src/EnemyAI.js
import * as THREE from 'three';

const FACTION_RELATIONS = {
    'PIRATE_FACTION': ['PLAYER_FACTION', 'CIVILIAN_FACTION']
};

export class EnemyAI {
    constructor(ship, projectileManager) {
        this.ship = ship;
        this.target = null;
        this.projectileManager = projectileManager;
        this.behavior = ship.behavior || 'standard';

        this.attackRange = 50.0;
        this.keepDistanceRange = 40.0;
        this.scanRange = 500.0;
        this.fleeHealthThreshold = 0.25;
        this.reengageShieldThreshold = 0.5;

        this.state = 'IDLE';
        this.stateTimer = 0;
        
        // --- NEW: Attack style mechanics ---
        this.attackStyle = 'TACTICAL'; // TACTICAL, BERSERK
        this.attackStyleTimer = 0;

        this.scanTimer = Math.random() * 2;
        this.scanInterval = 2.0 + Math.random();
        this.lastMissileTime = 0;
        this.missileCooldown = 5.0;
    }

    findTarget(allShips) {
        const hostileFactions = FACTION_RELATIONS[this.ship.faction];
        if (!hostileFactions) return;

        let closestTarget = null;
        let minDistance = this.scanRange;

        for (const potentialTarget of allShips) {
            if (potentialTarget === this.ship || potentialTarget.isDestroyed) continue;
            if (hostileFactions.includes(potentialTarget.faction)) {
                const distance = this.ship.mesh.position.distanceTo(potentialTarget.mesh.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestTarget = potentialTarget;
                }
            }
        }

        if (closestTarget) {
            this.target = closestTarget;
            this.state = 'ATTACKING';
            this.attackStyleTimer = THREE.MathUtils.randFloat(5, 10); // Start with tactical
            this.attackStyle = 'TACTICAL';
        } else {
            this.target = null;
            this.state = 'IDLE';
        }
    }

    update(delta, allShips) {
        if (!this.ship || this.ship.isDestroyed) return;

        if (this.ship.hull / this.ship.maxHull < this.fleeHealthThreshold && this.state !== 'FLEEING') {
            this.state = 'FLEEING';
            this.stateTimer = 10.0;
        }
        if (this.target && this.target.isDestroyed) {
            this.target = null;
            this.state = 'IDLE';
        }

        this.scanTimer -= delta;
        this.lastMissileTime += delta;

        switch (this.state) {
            case 'IDLE':
                if (this.scanTimer <= 0) {
                    this.findTarget(allShips);
                    this.scanTimer = this.scanInterval;
                }
                this.ship.decelerate(delta);
                break;
            case 'ATTACKING':
                this.handleAttacking(delta);
                break;
            case 'FLEEING':
                this.handleFleeing(delta);
                break;
            case 'REPOSITIONING':
                this.handleRepositioning(delta);
                break;
        }
    }

    handleAttacking(delta) {
        if (!this.target) { this.state = 'IDLE'; return; }

        // --- NEW: Update attack style ---
        this.attackStyleTimer -= delta;
        if (this.attackStyleTimer <= 0) {
            if (this.attackStyle === 'TACTICAL') {
                // After tactical period, 30% chance to go berserk
                if (Math.random() < 0.3) {
                    this.attackStyle = 'BERSERK';
                    this.attackStyleTimer = THREE.MathUtils.randFloat(4, 7); // Berserk for 4-7s
                } else {
                    this.attackStyleTimer = THREE.MathUtils.randFloat(5, 10); // Stay tactical
                }
            } else { // if BERSERK
                this.attackStyle = 'TACTICAL';
                this.attackStyleTimer = THREE.MathUtils.randFloat(8, 15); // Tactical for 8-15s
            }
        }

        const directionToTarget = new THREE.Vector3().subVectors(this.target.mesh.position, this.ship.mesh.position);
        const distanceToTarget = directionToTarget.length();
        directionToTarget.normalize();

        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionToTarget);
        this.ship.mesh.quaternion.slerp(targetQuaternion, this.ship.actualTurnSpeed * delta * 1.5);

        // --- NEW: AI movement depends on attack style ---
        const speedRatio = this.attackStyle === 'BERSERK' ? 1.0 : 0.75;
        this.ship.accelerate(delta, speedRatio);

        this.fireWeapons(directionToTarget, distanceToTarget);
    }

    fireWeapons(directionToTarget, distance) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.ship.mesh.quaternion);
        const isAimed = forward.dot(directionToTarget) > 0.95;
        if (!isAimed) return;

        for (const hardpoint of this.ship.hardpoints) {
            const weapon = hardpoint.weapon;
            if (!weapon) continue;

            const canAfford = this.ship.energy >= weapon.energyCost &&
                              (!weapon.ammoType || (this.ship.ammo.get(weapon.ammoType) || 0) >= weapon.ammoCost);

            if (!canAfford) continue;

            let shouldFire = false;
            switch (weapon.type) {
                case 'HOMING':
                    if (this.target && distance > 80 && distance < 400 && this.lastMissileTime > this.missileCooldown) {
                        shouldFire = true;
                        this.lastMissileTime = 0;
                    }
                    break;
                case 'LASER':
                case 'PROJECTILE':
                    if (distance < this.attackRange * 1.5) {
                        shouldFire = true;
                    }
                    break;
            }

            if (shouldFire) {
                this.ship.energy -= weapon.energyCost;
                if (weapon.ammoType) {
                    this.ship.ammo.set(weapon.ammoType, (this.ship.ammo.get(weapon.ammoType) || 0) - weapon.ammoCost);
                }
                this.projectileManager.fire(this.ship, weapon, this.target);
            }
        }
    }

    handleFleeing(delta) {
        this.stateTimer -= delta;
        if (!this.target) { this.state = 'IDLE'; return; }

        if (this.stateTimer <= 0 && this.ship.shield / this.ship.maxShield > this.reengageShieldThreshold) {
            this.state = 'REPOSITIONING';
            return;
        }

        const directionAway = new THREE.Vector3().subVectors(this.ship.mesh.position, this.target.mesh.position).normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionAway);
        this.ship.mesh.quaternion.slerp(targetQuaternion, this.ship.actualTurnSpeed * delta);
        this.ship.accelerate(delta, 1.0);
    }

    handleRepositioning(delta) {
        if (!this.target) { this.state = 'IDLE'; return; }
        const distanceToTarget = this.ship.mesh.position.distanceTo(this.target.mesh.position);

        if (distanceToTarget < this.scanRange * 0.8) {
            this.state = 'ATTACKING';
            return;
        }

        const directionToTarget = new THREE.Vector3().subVectors(this.target.mesh.position, this.ship.mesh.position).normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionToTarget);
        this.ship.mesh.quaternion.slerp(targetQuaternion, this.ship.actualTurnSpeed * delta);
        this.ship.accelerate(delta, 1.0);
    }
}