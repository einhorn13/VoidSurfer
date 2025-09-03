import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';

const ICON_SIZE = 4;
const BLINK_PERIOD = 1.0;

export class MinimapManager {
    constructor(spatialGrid, scanner, ecsWorld) {
        this.ecsWorld = ecsWorld;
        this.spatialGrid = spatialGrid;
        this.scanner = scanner;
        this.navigationService = serviceLocator.get('NavigationService');
        this.sensorConfig = serviceLocator.get('DataManager').getConfig('game_balance').playerSensors;
        
        this.canvas = document.getElementById('minimap-canvas');
        if (!this.canvas) {
            console.error("Minimap canvas not found.");
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * dpr;
        this.canvas.height = this.canvas.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);

        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        
        this.detectionRadius = this.sensorConfig.detectionRange;
        this.radius = Math.min(this.width, this.height) / 2 * 0.95;
        this.scale = this.radius / this.detectionRadius;

        this.playerInverseRotation = new THREE.Quaternion();
        this.targetEuler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.queryBox = new THREE.Box3();
        this.blinkTimer = 0;
        this.isBlinkOn = true;
    }

    update(delta, playerEntityId) {
        if (!this.canvas || playerEntityId === null) {
            if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height);
            return;
        }

        const playerTransform = this.ecsWorld.getComponent(playerEntityId, 'TransformComponent');
        if (!playerTransform) return;

        this.blinkTimer = (this.blinkTimer + delta) % BLINK_PERIOD;
        this.isBlinkOn = this.blinkTimer < BLINK_PERIOD / 2;

        this.playerInverseRotation.copy(playerTransform.rotation).invert();

        this._drawBackground();
        const nearbyEntities = this._getNearbyEntities(playerTransform.position);
        this._drawEntities(nearbyEntities, playerTransform);
        this._drawPlayerIcon();
    }

    _getNearbyEntities(center) {
        const size = new THREE.Vector3(1, 1, 1).multiplyScalar(this.detectionRadius * 2);
        this.queryBox.setFromCenterAndSize(center, size);
        return this.spatialGrid.getNearby({ boundingBox: this.queryBox });
    }

    _drawBackground() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius * 0.5, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX - this.radius, this.centerY);
        this.ctx.lineTo(this.centerX + this.radius, this.centerY);
        this.ctx.moveTo(this.centerX, this.centerY - this.radius);
        this.ctx.lineTo(this.centerX, this.centerY + this.radius);
        this.ctx.stroke();
    }

    _drawPlayerIcon() {
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX - 4, this.centerY);
        this.ctx.lineTo(this.centerX + 4, this.centerY);
        this.ctx.moveTo(this.centerX, this.centerY - 4);
        this.ctx.lineTo(this.centerX, this.centerY + 4);
        this.ctx.stroke();
    }
    
    _drawEntities(entities, playerTransform) {
        const navTarget = this.navigationService.getTarget();
        const navTargetId = (navTarget && navTarget.type === 'entity') ? navTarget.entityId : null;

        for (const { entityId } of entities) {
            if (entityId === playerTransform.entityId) continue;
            
            const icon = this.ecsWorld.getComponent(entityId, 'MapIconComponent');
            const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
            const render = this.ecsWorld.getComponent(entityId, 'RenderComponent');
            const staticData = this.ecsWorld.getComponent(entityId, 'StaticDataComponent');
            
            if (!icon || (health && health.state !== 'ALIVE') || (render && !render.isVisible) || !staticData) continue;
            
            const type = staticData.data.type;
            const validTypes = ['ship', 'station', 'salvage', 'item'];
            if (!validTypes.includes(type)) {
                continue;
            }

            const targetTransform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
            const relativePos = targetTransform.position.clone().sub(playerTransform.position);

            // For dynamic objects, check if they are within detection range. Static objects are always shown.
            if (!icon.isStatic && relativePos.length() > this.detectionRadius) continue;

            relativePos.applyQuaternion(this.playerInverseRotation);

            const baseScreenX = this.centerX + relativePos.x * this.scale;
            const baseScreenY = this.centerY + relativePos.z * this.scale;

            const stalkHeight = -relativePos.y * this.scale;
            const blipScreenX = baseScreenX;
            const blipScreenY = baseScreenY + stalkHeight;
            
            this.ctx.save();
            this.ctx.globalAlpha = 0.7;
            this.ctx.strokeStyle = icon.color;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(baseScreenX, baseScreenY);
            this.ctx.lineTo(blipScreenX, blipScreenY);
            this.ctx.stroke();
            this.ctx.restore();

            this.ctx.fillStyle = icon.color;
            
            switch(icon.iconType) {
                case 'triangle':
                    this.ctx.save();
                    this.ctx.translate(blipScreenX, blipScreenY);
                    this.targetEuler.setFromQuaternion(targetTransform.rotation).y -= playerTransform.rotation.y;
                    this.ctx.rotate(this.targetEuler.y);
                    this._drawTriangle(ICON_SIZE);
                    this.ctx.restore();
                    break;
                case 'square':
                case 'station':
                default:
                    this.ctx.fillRect(blipScreenX - ICON_SIZE / 2, blipScreenY - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE);
                    break;
            }

            if (entityId === navTargetId && this.isBlinkOn) {
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.strokeRect(blipScreenX - ICON_SIZE, blipScreenY - ICON_SIZE, ICON_SIZE * 2, ICON_SIZE * 2);
            }
        }
    }

    _drawTriangle(size) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(size * 0.8, size * 0.8);
        this.ctx.lineTo(-size * 0.8, size * 0.8);
        this.ctx.closePath();
        this.ctx.fill();
    }
}