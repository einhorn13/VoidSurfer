import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';

/**
 * Manages rendering of all world-space UI elements onto a dedicated canvas.
 * This is highly performant as it avoids DOM manipulation.
 */
export class WorldUIManager {
    constructor(scanner, spatialGrid, worldToScreenMapper, camera, ecsWorld) {
        this.camera = camera;
        this.ecsWorld = ecsWorld;
        this.worldToScreenMapper = worldToScreenMapper;
        this.scanner = scanner;
        this.spatialGrid = spatialGrid;
        this.navigationService = serviceLocator.get('NavigationService');
        this.playerShipId = null;

        this.canvas = document.getElementById('world-ui-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.navPointer = document.getElementById('nav-pointer');
        this.offscreenPointer = document.getElementById('nav-target-offscreen-pointer');

        this.crosshairRaycaster = new THREE.Raycaster();
        this.checkedEntityIds = new Set();
        this.queryBox = new THREE.Box3();
        this.queryBoxSize = new THREE.Vector3(1, 1, 1);
        this.currentRayPoint = new THREE.Vector3();
        this.intersectionPoint = new THREE.Vector3();
        
        this.resize();
    }
    
    setPlayerShip(entityId) {
        this.playerShipId = entityId;
    }
    
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
    }

    update() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this._updateCrosshair();
        this._updateScannerBrackets();
        this._updateNavTargetIndicators();
    }

    _updateCrosshair() {
        const playerHealth = this.ecsWorld.getComponent(this.playerShipId, 'HealthComponent');
        if (this.playerShipId === null || !playerHealth || playerHealth.state !== 'ALIVE' || !this.camera) {
            return;
        }

        const transform = this.ecsWorld.getComponent(this.playerShipId, 'TransformComponent');
        const startPoint = transform.position.clone();
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.rotation);
        this.crosshairRaycaster.set(startPoint, direction);
        
        let closestHit = null;
        this.checkedEntityIds.clear();

        const stepSize = this.spatialGrid.cellSize;
        const maxDistance = 5000;

        for (let dist = 0; dist < maxDistance; dist += stepSize) {
            this.currentRayPoint.copy(startPoint).addScaledVector(direction, dist);
            this.queryBox.setFromCenterAndSize(this.currentRayPoint, this.queryBoxSize);
            const nearby = this.spatialGrid.getNearby({ boundingBox: this.queryBox });

            for (const { entityId } of nearby) {
                if (this.checkedEntityIds.has(entityId) || entityId === this.playerShipId) continue;
                this.checkedEntityIds.add(entityId);

                const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
                const render = this.ecsWorld.getComponent(entityId, 'RenderComponent');
                if (health && health.state !== 'ALIVE' || !render || !render.isVisible) continue;

                const collision = this.ecsWorld.getComponent(entityId, 'CollisionComponent');
                if (!collision) continue;

                if (this.crosshairRaycaster.ray.intersectSphere(collision.boundingSphere, this.intersectionPoint)) {
                    const hitDistance = startPoint.distanceTo(this.intersectionPoint);
                    if (closestHit === null || hitDistance < closestHit.distance) {
                        closestHit = {
                            point: this.intersectionPoint.clone(),
                            distance: hitDistance
                        };
                    }
                }
            }
            if (closestHit && dist > closestHit.distance) break;
        }
        
        const targetPoint3D = closestHit ? closestHit.point : startPoint.clone().add(direction.multiplyScalar(1500));
        const screenPos = targetPoint3D.clone().project(this.camera);

        if (screenPos.z > 1) return;

        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

        this.ctx.font = 'bold 20px "Courier New"';
        this.ctx.fillStyle = '#00ff00';
        this.ctx.shadowColor = '#00ff00';
        this.ctx.shadowBlur = 5;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('+', x, y);
        this.ctx.shadowBlur = 0;
    }

    _updateScannerBrackets() {
        if (this.playerShipId === null || !this.scanner || !this.camera) return;

        const relationshipColor = {
            'PIRATE_FACTION': 'red', 'CIVILIAN_FACTION': 'white',
            'PLAYER_FACTION': 'lime', 'LOOT': '#00aaff'
        };

        const projectionVector = new THREE.Vector4();

        this.scanner.targets.forEach(targetInfo => {
            const targetType = targetInfo.type;
            if (targetType !== 'ship' && targetType !== 'salvage' && targetType !== 'item') {
                return;
            }

            const transform = this.ecsWorld.getComponent(targetInfo.entityId, 'TransformComponent');
            const collision = this.ecsWorld.getComponent(targetInfo.entityId, 'CollisionComponent');
            if (!transform || !collision) return;

            // Project the center point to get screen coordinates and distance factor (w)
            projectionVector.set(transform.position.x, transform.position.y, transform.position.z, 1.0);
            projectionVector.applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix);
            
            if (projectionVector.w <= 0) return; // Behind the camera

            const x = (projectionVector.x / projectionVector.w * 0.5 + 0.5) * window.innerWidth;
            const y = (-projectionVector.y / projectionVector.w * 0.5 + 0.5) * window.innerHeight;

            // Calculate apparent size based on distance
            const apparentRadius = (collision.boundingSphere.radius / projectionVector.w) * 1000;
            const size = Math.max(16, apparentRadius);

            const color = relationshipColor[targetInfo.faction] || 'yellow';
            
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 1.5;
            this.ctx.strokeRect(x - size/2, y - size/2, size, size);

            this.ctx.font = '12px "Courier New"';
            this.ctx.fillStyle = color;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = 'black';
            this.ctx.shadowBlur = 2;
            this.ctx.fillText(`${Math.round(targetInfo.distance)}m`, x, y + size / 2 + 12);
            this.ctx.shadowBlur = 0;
        });
    }

    _updateNavTargetIndicators() {
        const target = this.navigationService.getTarget();
        if (target === null) {
            this.navPointer.style.display = 'none';
            this.offscreenPointer.style.display = 'none';
            return;
        }

        const projection = this.worldToScreenMapper.project(target.position);

        const isFullyVisible = projection.onScreen &&
                               projection.x >= 0 && projection.x <= window.innerWidth &&
                               projection.y >= 0 && projection.y <= window.innerHeight;
        
        if (isFullyVisible) {
            this.navPointer.style.display = 'block';
            this.offscreenPointer.style.display = 'none';
            this.navPointer.style.transform = `translate(${projection.x}px, ${projection.y}px) translate(-50%, -50%)`;
        } else {
            this.navPointer.style.display = 'none';
            const pointerData = this.worldToScreenMapper.getOffscreenPointerData(target.position);
            if (pointerData) {
                this.offscreenPointer.style.display = 'block';
                this.offscreenPointer.style.transform = `translate(${pointerData.x}px, ${pointerData.y}px) translate(-50%, -50%) rotate(${pointerData.rotation}rad)`;
            } else {
                this.offscreenPointer.style.display = 'none';
            }
        }
    }
}