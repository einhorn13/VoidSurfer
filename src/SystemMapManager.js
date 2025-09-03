import * as THREE from 'three';
import { eventBus } from './EventBus.js';
import { serviceLocator } from './ServiceLocator.js';

const MIN_SCALE = 0.2;
const MAX_SCALE = 2;
const INITIAL_SCALE = 0.5;

export class SystemMapManager {
    constructor(scanner, ecsWorld, gameStateManager) {
        this.ecsWorld = ecsWorld;
        this.gameStateManager = gameStateManager;
        this.scanner = scanner;
        this.navigationService = serviceLocator.get('NavigationService');
        this.dataManager = serviceLocator.get('DataManager');
        this.sensorConfig = this.dataManager.getConfig('game_balance').playerSensors;
        
        this.container = document.getElementById('system-map-container');
        this.canvas = document.getElementById('system-map-canvas');
        this.infoPanel = document.getElementById('system-map-info-panel');
        this.ctx = this.canvas.getContext('2d');
        
        this.isOpen = false;
        this.needsRedraw = true;
        
        this.scale = INITIAL_SCALE;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isPanning = false;
        this.lastPanPosition = { x: 0, y: 0 };
        
        this.mapObjects = [];
        this.hoveredObject = null;

        this.reusableEuler = new THREE.Euler();
        
        this._addEventListeners();
    }

    _addEventListeners() {
        eventBus.on('window_resized', () => this.resize());
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    }

    handleMouseDown(e) {
        if (e.button === 0) {
            this.isPanning = true;
            this.lastPanPosition = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        }
    }

    handleMouseUp() {
        this.isPanning = false;
        this.canvas.style.cursor = this.hoveredObject ? 'pointer' : 'grab';
    }

    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newScale = THREE.MathUtils.clamp(this.scale * zoomFactor, MIN_SCALE, MAX_SCALE);
        
        this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
        this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
        
        this.scale = newScale;
        this.needsRedraw = true;
    }

    handleMouseLeave() {
        this.isPanning = false;
        if (this.hoveredObject !== null) {
            this.hoveredObject = null;
            this._updateInfoPanel();
            this.needsRedraw = true;
        }
    }

    handleMouseMove(event) {
        if (this.isPanning) {
            const dx = event.clientX - this.lastPanPosition.x;
            const dy = event.clientY - this.lastPanPosition.y;
            this.offsetX += dx;
            this.offsetY += dy;
            this.lastPanPosition = { x: event.clientX, y: event.clientY };
            this.needsRedraw = true;
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        let foundObject = null;
        for (const obj of this.mapObjects) {
            if (obj.type === 'zone') continue;
            const distance = Math.sqrt((x - obj.x)**2 + (y - obj.y)**2);
            if (distance < obj.size * 2.5 * Math.sqrt(this.scale)) {
                foundObject = obj;
                break;
            }
        }
        if (!foundObject) {
            for (const obj of this.mapObjects) {
                if (obj.type !== 'zone') continue;
                const distance = Math.sqrt((x - obj.x)**2 + (y - obj.y)**2);
                if (distance < obj.size * this.scale) {
                    foundObject = obj;
                    break;
                }
            }
        }
        
        if (foundObject !== this.hoveredObject) {
            this.hoveredObject = foundObject;
            this._updateInfoPanel();
            this.needsRedraw = true;
        }
        this.canvas.style.cursor = this.hoveredObject ? 'pointer' : 'grab';
    }

    handleClick(event) {
        if (this.isPanning) return;

        if (this.hoveredObject) {
            if (this.hoveredObject.type === 'zone') {
                 this.navigationService.setTarget({
                    type: 'zone',
                    position: this.hoveredObject.worldPosition.clone(),
                    name: this.hoveredObject.name
                });
            } else {
                this.navigationService.setTarget({
                    type: 'entity',
                    entityId: this.hoveredObject.entityId,
                    position: this.hoveredObject.worldPosition.clone(),
                    name: this.hoveredObject.name
                });
            }
        } else {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const worldPos = this.screenToWorld(mouseX, mouseY);

            this.navigationService.setTarget({
                type: 'waypoint',
                position: new THREE.Vector3(worldPos.x, 0, worldPos.y),
                name: `Waypoint (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`
            });
        }
        
        this.needsRedraw = true;
    }
    
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.offsetX) / this.scale;
        const worldZ = -(screenY - this.offsetY) / this.scale;
        return { x: worldX, y: worldZ };
    }

    worldToScreen(worldX, worldZ) {
        const screenX = worldX * this.scale + this.offsetX;
        const screenY = -worldZ * this.scale + this.offsetY;
        return { x: screenX, y: screenY };
    }

    _updateInfoPanel() {
        if (!this.hoveredObject) {
            this.infoPanel.style.display = 'none';
            return;
        }
        
        const { type, name, faction, relation, threat } = this.hoveredObject;
        let content = `<h3>${name}</h3>`;
        content += `<p>Type: ${type.charAt(0).toUpperCase() + type.slice(1)}</p>`;
        
        if (faction) {
            content += `<p class="faction-${relation}">Faction: ${faction.replace('_FACTION', '')}</p>`;
        }
        
        if (threat !== undefined) {
             content += `<p>Threat Level: ${threat}</p>`;
        }
        
        this.infoPanel.innerHTML = content;
        this.infoPanel.style.display = 'block';
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.gameStateManager.setMapOpen(this.isOpen);

        if (this.isOpen) {
            this.container.style.display = 'flex';
            this.resize();
            this.needsRedraw = true;
            this.scale = INITIAL_SCALE;
        } else {
            this.container.style.display = 'none';
        }
    }

    resize() {
        if (!this.isOpen) return;
        const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
        this.canvas.width = size;
        this.canvas.height = size;

        const playerShipId = this.scanner.playerShipId;
        if (playerShipId) {
            const playerTransform = this.ecsWorld.getComponent(playerShipId, 'TransformComponent');
            if(playerTransform) {
                this.offsetX = this.canvas.width / 2 - playerTransform.position.x * this.scale;
                this.offsetY = this.canvas.height / 2 + playerTransform.position.z * this.scale;
            }
        }

        this.needsRedraw = true;
    }

    update() {
        if (!this.isOpen) return;
        this.needsRedraw = true;
        if (this.needsRedraw) {
            this.render();
            this.needsRedraw = false;
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#000500';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const entities = this.ecsWorld.query(['MapIconComponent', 'TransformComponent']);
        if (entities.length === 0) return;
        
        this.mapObjects = [];
        
        this._collectZones();
        for (const entityId of entities) {
            if (entityId === this.scanner.playerShipId) continue;
            this._collectMapObject(entityId);
        }
        
        this.mapObjects.sort((a, b) => (a.type === 'zone' ? -1 : 1));
        this.mapObjects.forEach(obj => this._drawObject(obj));
        
        this._drawSensorRanges();
        this._drawRouteAndPlayer();
    }
    
    _drawSensorRanges() {
        const playerShipId = this.scanner.playerShipId;
        if (playerShipId === null) return;
        
        const playerTransform = this.ecsWorld.getComponent(playerShipId, 'TransformComponent');
        if (!playerTransform) return;

        const playerPos = this.worldToScreen(playerTransform.position.x, playerTransform.position.z);

        this.ctx.setLineDash([2, 8]);
        
        const radiusDetection = this.sensorConfig.detectionRange * this.scale;
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(playerPos.x, playerPos.y, radiusDetection, 0, 2 * Math.PI);
        this.ctx.stroke();

        const radiusVisibility = this.sensorConfig.maxVisibilityRange * this.scale;
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(playerPos.x, playerPos.y, radiusVisibility, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }

    _drawRouteAndPlayer() {
        const playerShipId = this.scanner.playerShipId;
        if (playerShipId === null) return;
        
        const playerTransform = this.ecsWorld.getComponent(playerShipId, 'TransformComponent');
        if (!playerTransform) return;

        const start = this.worldToScreen(playerTransform.position.x, playerTransform.position.z);
        
        const navTarget = this.navigationService.getTarget();
        if (navTarget) {
            const end = this.worldToScreen(navTarget.position.x, navTarget.position.z);
            this.ctx.beginPath();
            this.ctx.setLineDash([5, 15]);
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.strokeStyle = '#00ffaa';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        const playerIcon = this.ecsWorld.getComponent(playerShipId, 'MapIconComponent');
        if (playerIcon) {
            const size = 4 * Math.sqrt(this.scale) * 2;
            this.ctx.fillStyle = playerIcon.color;
            this._drawTriangle(start.x, start.y, size, playerTransform.rotation);
        }
    }

    _collectZones() {
        const zonesConfig = this.dataManager.getConfig('zones_config');
        const gameDirector = serviceLocator.get('GameDirector');
        
        for (const zone of zonesConfig) {
            if (zone.shape === 'world') continue;

            const worldPosition = new THREE.Vector3().fromArray(zone.position);
            const screenPos = this.worldToScreen(worldPosition.x, worldPosition.z);
            
            this.mapObjects.push({
                x: screenPos.x,
                y: screenPos.y,
                size: zone.size,
                worldPosition: worldPosition,
                name: zone.name,
                type: 'zone',
                threat: gameDirector.zoneThreatLevels.get(zone.id) ?? zone.initialThreat,
            });
        }
    }

    _collectMapObject(entityId) {
        const icon = this.ecsWorld.getComponent(entityId, 'MapIconComponent');
        const transform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
        const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
        const staticData = this.ecsWorld.getComponent(entityId, 'StaticDataComponent');
        const factionComp = this.ecsWorld.getComponent(entityId, 'FactionComponent');
        
        if (health && health.state !== 'ALIVE') return;

        const screenPos = this.worldToScreen(transform.position.x, transform.position.z);
        const type = staticData?.data?.type || 'Object';
        
        const playerShipId = this.scanner.playerShipId;
        if (playerShipId === null) return;
        const playerTransform = this.ecsWorld.getComponent(playerShipId, 'TransformComponent');
        if (!playerTransform) return;
        
        if (!icon.isStatic) {
             const distance = playerTransform.position.distanceTo(transform.position);
             if (distance > this.sensorConfig.maxVisibilityRange) {
                 return;
             }
        }

        const scaledSize = icon.isStatic ? 4 : 3;
        if (screenPos.x < -scaledSize || screenPos.x > this.canvas.width + scaledSize || screenPos.y < -scaledSize || screenPos.y > this.canvas.height + scaledSize) {
            return;
        }

        const name = staticData?.data?.name || 'Unknown';
        
        let relation = 'neutral';
        const playerFaction = this.ecsWorld.getComponent(playerShipId, 'FactionComponent');
        if (playerFaction && factionComp) {
            const hostileFactions = this.scanner.factionRelations[playerFaction.name] || [];
            if (hostileFactions.includes(factionComp.name)) {
                relation = 'hostile';
            } else if (playerFaction.name === factionComp.name) {
                relation = 'friendly';
            }
        }
        
        this.mapObjects.push({
            x: screenPos.x,
            y: screenPos.y,
            size: scaledSize,
            entityId,
            worldPosition: transform.position,
            rotation: transform.rotation,
            name,
            type,
            icon: icon.iconType,
            color: icon.color,
            isStatic: icon.isStatic,
            faction: factionComp?.name,
            relation
        });
    }

    _drawObject(obj) {
        if (obj.type === 'zone') {
            this._drawZone(obj);
            return;
        }

        this.ctx.fillStyle = obj.color;
        this.ctx.strokeStyle = obj.color;
        this.ctx.lineWidth = 1;

        const size = obj.size * Math.sqrt(this.scale) * 2;

        switch (obj.icon) {
            case 'triangle':
                this._drawTriangle(obj.x, obj.y, size, obj.rotation);
                break;
            case 'square':
                this.ctx.fillRect(obj.x - size / 2, obj.y - size / 2, size, size);
                break;
            case 'circle':
            case 'station':
            case 'sun':
                this.ctx.beginPath();
                this.ctx.arc(obj.x, obj.y, size, 0, 2 * Math.PI);
                this.ctx.fill();
                break;
        }

        if (obj.isStatic) {
            const textAlpha = THREE.MathUtils.smoothstep(this.scale, 0.4, 1.2);
            if (textAlpha > 0) {
                const fontSize = THREE.MathUtils.lerp(10, 16, Math.sqrt(this.scale));
                this.ctx.font = `${fontSize}px "Courier New"`;
                this.ctx.fillStyle = `rgba(204, 204, 204, ${textAlpha})`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(obj.name, obj.x, obj.y + size + fontSize * 1.2);
            }
        }

        if (obj === this.hoveredObject) {
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            const hoverRadius = (obj.icon === 'triangle' ? size : size) * 1.5;
            this.ctx.arc(obj.x, obj.y, hoverRadius, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
    }
    
    _drawZone(zone) {
        const radius = zone.size * this.scale;
        
        let color;
        if (zone.threat <= 1) color = 'rgba(0, 100, 255, 0.15)';
        else if (zone.threat <= 3) color = 'rgba(255, 200, 0, 0.15)';
        else color = 'rgba(255, 50, 0, 0.15)';

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(zone.x, zone.y, radius, 0, 2 * Math.PI);
        this.ctx.fill();

        if (zone === this.hoveredObject) {
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else {
             this.ctx.strokeStyle = color.replace('0.15', '0.4');
             this.ctx.lineWidth = 1;
             this.ctx.stroke();
        }

        const textAlpha = THREE.MathUtils.smoothstep(this.scale, 0.3, 0.8);
        if (textAlpha > 0) {
            const fontSize = THREE.MathUtils.lerp(12, 18, Math.sqrt(this.scale));
            this.ctx.font = `bold ${fontSize}px "Courier New"`;
            this.ctx.fillStyle = `rgba(170, 170, 170, ${textAlpha})`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(zone.name, zone.x, zone.y);
        }
    }

    _drawTriangle(x, y, size, rotationQuat) {
        this.reusableEuler.setFromQuaternion(rotationQuat);
        const angle = this.reusableEuler.y;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(-angle);
        
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size * 0.8);
        this.ctx.lineTo(size * 0.7, size * 0.7);
        this.ctx.lineTo(-size * 0.7, size * 0.7);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
}