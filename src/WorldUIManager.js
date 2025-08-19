// src/WorldUIManager.js
import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';

const MAX_SCANNER_TARGETS = 50;

/**
 * Manages DOM elements that are positioned based on 3D world coordinates.
 */
export class WorldUIManager {
    constructor() {
        this.camera = serviceLocator.get('Camera');
        this.scanner = serviceLocator.get('Scanner');
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.playerShipId = null;

        this.scannerContainer = document.getElementById('scanner-container');
        this.navPointer = document.getElementById('nav-pointer');
        this.crosshair = document.getElementById('crosshair');

        this.crosshairRaycaster = new THREE.Raycaster();
        this.scannerTargetPool = [];
        this._initScannerPool();

        // Re-usable vector for intersection calculations
        this.intersectionPoint = new THREE.Vector3();
    }
    
    setPlayerShip(entityId) {
        this.playerShipId = entityId;
    }

    _initScannerPool() {
        for (let i = 0; i < MAX_SCANNER_TARGETS; i++) {
            const boxDiv = document.createElement('div');
            boxDiv.className = 'scanner-target';
            boxDiv.style.display = 'none';
            this.scannerContainer.appendChild(boxDiv);

            const textDiv = document.createElement('div');
            textDiv.className = 'scanner-distance-text';
            textDiv.style.display = 'none';
            this.scannerContainer.appendChild(textDiv);
            
            this.scannerTargetPool.push({ box: boxDiv, text: textDiv });
        }
    }

    update() {
        this._updateCrosshair();
        this._updateScanner();
    }

    _updateCrosshair() {
        const playerHealth = this.ecsWorld.getComponent(this.playerShipId, 'HealthComponent');
        if (this.playerShipId === null || !playerHealth || playerHealth.isDestroyed || !this.camera) {
            this.crosshair.style.display = 'none';
            return;
        }
        this.crosshair.style.display = 'block';

        const transform = this.ecsWorld.getComponent(this.playerShipId, 'TransformComponent');
        const startPoint = transform.position.clone();
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.rotation);
        this.crosshairRaycaster.set(startPoint, direction);

        const shipIds = this.ecsWorld.query(['ShipTag']);
        const asteroidIds = this.ecsWorld.query(['AsteroidTag']);
        const stationIds = this.ecsWorld.query(['StationComponent']);
        const celestialIds = this.ecsWorld.query(['CelestialBodyTag']);

        const targetableEntityIds = [...shipIds, ...asteroidIds, ...stationIds, ...celestialIds];
        
        let closestHit = null;

        // OPTIMIZATION: Instead of raycasting against complex meshes,
        // we manually test against the much simpler bounding spheres.
        for (const targetId of targetableEntityIds) {
            if (targetId === this.playerShipId) continue;
            
            const health = this.ecsWorld.getComponent(targetId, 'HealthComponent');
            if (health && health.isDestroyed) continue;

            const collision = this.ecsWorld.getComponent(targetId, 'CollisionComponent');
            if (!collision) continue;

            // Perform a fast ray-sphere intersection test
            if (this.crosshairRaycaster.ray.intersectSphere(collision.boundingSphere, this.intersectionPoint)) {
                const distance = startPoint.distanceToSquared(this.intersectionPoint); // Use squared distance for performance
                if (closestHit === null || distance < closestHit.distanceSq) {
                    closestHit = {
                        point: this.intersectionPoint.clone(),
                        distanceSq: distance
                    };
                }
            }
        }
        
        let targetPoint3D;
        if (closestHit) {
            targetPoint3D = closestHit.point;
        } else {
            targetPoint3D = startPoint.clone().add(direction.multiplyScalar(1500));
        }

        const screenPos = targetPoint3D.clone().project(this.camera);

        if (screenPos.z > 1) {
            this.crosshair.style.display = 'none';
            return;
        }

        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

        this.crosshair.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }

    _updateScanner() {
        if (this.playerShipId === null || !this.scanner || !this.camera) return;

        // FIX: Add LOOT category with a blue color
        const relationshipColor = {
            'PIRATE_FACTION': 'red',
            'CIVILIAN_FACTION': 'white',
            'PLAYER_FACTION': 'lime',
            'LOOT': '#00aaff'
        };
        let poolIndex = 0;

        this.scanner.targets.forEach(targetInfo => {
            if (poolIndex >= MAX_SCANNER_TARGETS) return;
            
            const transform = this.ecsWorld.getComponent(targetInfo.entityId, 'TransformComponent');
            if (!transform) return;

            const screenPos = transform.position.clone().project(this.camera);
            if (screenPos.z > 1) return;

            const targetUI = this.scannerTargetPool[poolIndex];
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

            targetUI.box.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            targetUI.box.style.borderColor = relationshipColor[targetInfo.faction] || 'yellow';
            targetUI.box.style.display = 'block';

            targetUI.text.textContent = `${Math.round(targetInfo.distance)}m`;
            targetUI.text.style.transform = `translate(${x}px, ${y + 10}px) translate(-50%, 0)`;
            targetUI.text.style.display = 'block';
            targetUI.text.style.color = relationshipColor[targetInfo.faction] || 'yellow';
            
            poolIndex++;
        });

        for (let i = poolIndex; i < MAX_SCANNER_TARGETS; i++) {
            this.scannerTargetPool[i].box.style.display = 'none';
            this.scannerTargetPool[i].text.style.display = 'none';
        }

        if (this.scanner.navTargetId !== null) {
            const transform = this.ecsWorld.getComponent(this.scanner.navTargetId, 'TransformComponent');
            if (!transform) {
                this.navPointer.style.display = 'none';
                return;
            }

            const screenPos = transform.position.clone().project(this.camera);

            if (screenPos.z > 1) {
                this.navPointer.style.display = 'none';
            } else {
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
                this.navPointer.style.display = 'block';
                this.navPointer.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            }
        } else {
            this.navPointer.style.display = 'none';
        }
    }
}