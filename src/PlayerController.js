// src/PlayerController.js
import * as THREE from 'three';
import { keyState, mouseState } from './InputController.js';

const BOOST_ENERGY_COST_PER_SECOND = 12.5; 
const BOOST_ACTIVATION_COST = 10;
const BOOST_MULTIPLIER = 2.5;

const MOUSE_DEAD_ZONE = 0.05; // A small 5% dead zone
const MOUSE_MAX_RANGE = 0.3;  // Reach 100% turn speed at 30% of screen
const MOUSE_SENSITIVITY = 1.0;  // Can be adjusted for feel

export class PlayerController {
    constructor(ship, camera, projectileManager, gameStateManager, scanner, worldManager) {
        this.ship = ship;
        this.camera = camera;
        this.projectileManager = projectileManager;
        this.gameStateManager = gameStateManager;
        this.scanner = scanner;
        this.worldManager = worldManager;

        this.timeSinceLastShot = 0;
        this.isBoosting = false;
        this.targetFov = 75;
    }

    update(delta) {
        if (!this.gameStateManager.isPlayerControlEnabled || !this.ship || this.ship.isDestroyed) return;

        this.handleMovement(delta);
        this.handleWeapons(delta);
        this.handleTargeting();
        this.updateCamera(delta);
    }

    handleMovement(delta) {
        if (keyState['j']) {
            if (!this.isBoosting && this.ship.energy > BOOST_ACTIVATION_COST) {
                this.isBoosting = true;
                this.ship.energy -= BOOST_ACTIVATION_COST;
            }
            if (this.isBoosting && this.ship.energy > 0) {
                this.ship.boostMultiplier = BOOST_MULTIPLIER;
                this.ship.energy -= BOOST_ENERGY_COST_PER_SECOND * delta;
            } else {
                this.isBoosting = false;
                this.ship.boostMultiplier = 1.0;
            }
        } else {
            this.isBoosting = false;
            this.ship.boostMultiplier = 1.0;
        }
        
        if (keyState.mouseLeft) {
            const turnSpeed = delta * MOUSE_SENSITIVITY;

            // Yaw (left/right)
            if (Math.abs(mouseState.x) > MOUSE_DEAD_ZONE) {
                const relativeX = Math.abs(mouseState.x) - MOUSE_DEAD_ZONE;
                const yawStrength = Math.min(relativeX / MOUSE_MAX_RANGE, 1.0);
                this.ship.turnYaw(-Math.sign(mouseState.x) * yawStrength * turnSpeed);
            }

            // Pitch (up/down)
            if (Math.abs(mouseState.y) > MOUSE_DEAD_ZONE) {
                const relativeY = Math.abs(mouseState.y) - MOUSE_DEAD_ZONE;
                const pitchStrength = Math.min(relativeY / MOUSE_MAX_RANGE, 1.0);
                this.ship.turnPitch(Math.sign(mouseState.y) * pitchStrength * turnSpeed);
            }
        } else {
            const turnDirection = delta;
            if (keyState['a'] || keyState['arrowleft']) this.ship.turnYaw(turnDirection);
            if (keyState['d'] || keyState['arrowright']) this.ship.turnYaw(-turnDirection);
            if (keyState['w'] || keyState['arrowup']) this.ship.turnPitch(turnDirection);
            if (keyState['s'] || keyState['arrowdown']) this.ship.turnPitch(-turnDirection);
        }

        if (keyState['q']) this.ship.turnRoll(delta);
        if (keyState['e']) this.ship.turnRoll(-delta);

        if (keyState['shift']) {
            this.ship.accelerate(delta);
        } else {
            this.ship.decelerate(delta);
        }
    }

    handleWeapons(delta) {
        if (keyState['1']) this.ship.selectedWeaponIndex = 0;
        if (keyState['2'] && this.ship.hardpoints.length > 1) this.ship.selectedWeaponIndex = 1;
        else if (keyState['2']) this.ship.selectedWeaponIndex = 0;

        this.timeSinceLastShot += delta;
        const currentWeapon = this.ship.getCurrentWeapon();
        
        if (currentWeapon && keyState[' '] && this.timeSinceLastShot >= currentWeapon.fireRate) {
            if (this.ship.energy < currentWeapon.energyCost) return;
            const currentAmmo = this.ship.ammo.get(currentWeapon.ammoType) || 0;
            if (currentWeapon.ammoType && currentAmmo < currentWeapon.ammoCost) return;

            let target = null;
            if (currentWeapon.type === 'HOMING') {
                target = this.scanner.navTarget && !this.scanner.navTarget.isDestroyed ? this.scanner.navTarget : null;
                if (!target) return;
            }

            this.ship.energy -= currentWeapon.energyCost;
            if (currentWeapon.ammoType) {
                this.ship.ammo.set(currentWeapon.ammoType, currentAmmo - currentWeapon.ammoCost);
            }
            
            this.projectileManager.fire(this.ship, currentWeapon, target);
            this.timeSinceLastShot = 0;
        }
    }

    handleTargeting() {
        if (keyState['t']) {
            this.scanner.cycleTarget(this.worldManager.allShips, this.ship);
            keyState['t'] = false;
        }
    }
    
    updateCamera(delta) {
        this.targetFov = this.isBoosting ? 90 : 75;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, delta * 5);
        this.camera.updateProjectionMatrix();

        const idealOffset = new THREE.Vector3(0, 3, 7);
        idealOffset.applyQuaternion(this.ship.mesh.quaternion);
        const cameraPosition = this.ship.mesh.position.clone().add(idealOffset);
        this.camera.position.lerp(cameraPosition, 0.2);
        this.camera.quaternion.slerp(this.ship.mesh.quaternion, 0.1);
    }
}