// src/HUDManager.js
import { serviceLocator } from './ServiceLocator.js';

/**
 * Manages rendering the 2D canvas Heads-Up Display.
 */
export class HUDManager {
    constructor() {
        this.dataManager = serviceLocator.get('DataManager');
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.scanner = serviceLocator.get('Scanner');
        
        this.canvas = document.getElementById('hud-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.targetDisplay = document.getElementById('target-display');

        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    update(playerEntityId, gameState) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._updateTargetDisplay(playerEntityId);
        
        if (playerEntityId === null) return;
        
        const health = this.ecsWorld.getComponent(playerEntityId, 'HealthComponent');
        if (!health) return;

        this.ctx.font = '14px "Courier New", Courier, monospace';
        this.ctx.fillStyle = '#0f0';

        if (health.isDestroyed) {
            this.ctx.font = 'bold 24px "Courier New", Courier, monospace';
            this.ctx.fillStyle = '#f00';
            this.ctx.fillText('SHIP DESTROYED', 10, 40);
            this.ctx.font = '14px "Courier New", Courier, monospace';
            this.ctx.fillStyle = '#0f0';
            this.ctx.fillText(`Credits: ${gameState.credits} CR`, 10, 80);
            return;
        }

        const physics = this.ecsWorld.getComponent(playerEntityId, 'PhysicsComponent');
        const energy = this.ecsWorld.getComponent(playerEntityId, 'EnergyComponent');
        if (!physics || !energy) return;

        const speed = Math.round(physics.velocity.length());
        this.ctx.fillText(`Speed: ${speed} m/s`, 10, 20);
        this.ctx.fillText(`Credits: ${gameState.credits} CR`, 200, 20);

        this._drawBar(30, 'Shield', health.shield.current, health.shield.max, '#00aaff');
        this._drawBar(48, 'Hull', health.hull.current, health.hull.max, '#ffaa00');
        this._drawBar(66, 'Energy', energy.current, energy.max, '#ffff00');

        this._drawWeaponList(playerEntityId);
    }
    
    _updateTargetDisplay(playerEntityId) {
        const targetId = this.scanner.navTargetId;

        if (targetId === null || !this.ecsWorld.hasEntity(targetId)) {
            if (this.targetDisplay.style.display !== 'none') this.targetDisplay.style.display = 'none';
            return;
        }

        const targetTransform = this.ecsWorld.getComponent(targetId, 'TransformComponent');
        const targetStaticData = this.ecsWorld.getComponent(targetId, 'StaticDataComponent');
        const playerTransform = this.ecsWorld.getComponent(playerEntityId, 'TransformComponent');

        if (!targetTransform || !targetStaticData || !playerTransform) {
            if (this.targetDisplay.style.display !== 'none') this.targetDisplay.style.display = 'none';
            return;
        }
        
        if (this.targetDisplay.style.display !== 'block') this.targetDisplay.style.display = 'block';

        const distance = playerTransform.position.distanceTo(targetTransform.position);
        const name = targetStaticData.data.name || 'Unknown Target';
        const distanceStr = Math.round(distance) + 'm';

        let healthHTML = '';
        const targetHealth = this.ecsWorld.getComponent(targetId, 'HealthComponent');

        if (targetHealth) {
            const shieldPercent = targetHealth.shield.max > 0 ? (targetHealth.shield.current / targetHealth.shield.max) * 100 : 0;
            const hullPercent = targetHealth.hull.max > 0 ? (targetHealth.hull.current / targetHealth.hull.max) * 100 : 0;
            
            healthHTML = `
                <div class="target-bar-container">
                    <span class="target-bar-label">SHD</span>
                    <div class="target-bar">
                        <div class="target-bar-fill" style="width: ${shieldPercent}%; background-color: #00aaff;"></div>
                    </div>
                </div>
                <div class="target-bar-container">
                    <span class="target-bar-label">HULL</span>
                    <div class="target-bar">
                        <div class="target-bar-fill" style="width: ${hullPercent}%; background-color: #ffaa00;"></div>
                    </div>
                </div>
            `;
        }

        this.targetDisplay.innerHTML = `
            <div class="target-name">${name} [${distanceStr}]</div>
            ${healthHTML}
        `;
    }

    _drawWeaponList(playerEntityId) {
        let weaponY = 90;
        const lineHeight = 16;
        
        const hardpoints = this.ecsWorld.getComponent(playerEntityId, 'HardpointComponent');
        const ammo = this.ecsWorld.getComponent(playerEntityId, 'AmmoComponent');
        if (!hardpoints || !ammo) return;

        hardpoints.hardpoints.forEach((hp, index) => {
            const weapon = hp.weapon;
            const isSelected = index === hardpoints.selectedWeaponIndex;
            
            let line = '';
            line += isSelected ? '> ' : '  ';
            line += `[${index + 1}]`;

            this.ctx.fillStyle = isSelected ? '#0ff' : '#0f0';
            
            if (weapon.ammoType === 'MISSILE') {
                const ammoCount = ammo.ammo.get('MISSILE') || 0;
                const iconColor = '#0f0';
                
                const weaponText = `${line} ${weapon.name}`;
                this.ctx.fillText(weaponText, 10, weaponY);
                
                const textMetrics = this.ctx.measureText(weaponText);
                const iconX = 10 + textMetrics.width + 10;
                const countX = iconX + 8;
                
                this._drawMissileIcon(iconX, weaponY - 10, iconColor);
                this.ctx.fillStyle = iconColor;
                this.ctx.fillText(`: ${ammoCount}`, countX, weaponY);

            } else {
                line += ` ${weapon.name}`;
                if (weapon.ammoType) {
                    const ammoCount = ammo.ammo.get(weapon.ammoType) || 0;
                    line += ` (${ammoCount})`;
                }
                this.ctx.fillText(line, 10, weaponY);
            }
            
            weaponY += lineHeight;
        });
    }

    _drawBar(y, label, value, max, color) {
        const barWidth = 150;
        const barHeight = 12;
        const x = 80;
        const percent = max > 0 ? value / max : 0;
        const filledWidth = barWidth * percent;

        this.ctx.fillStyle = '#0f0';
        this.ctx.fillText(label, 10, y + barHeight - 2);
        this.ctx.fillStyle = '#050';
        this.ctx.fillRect(x, y, barWidth, barHeight);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, filledWidth, barHeight);
        this.ctx.strokeStyle = '#0f0';
        this.ctx.strokeRect(x, y, barWidth, barHeight);
        this.ctx.fillStyle = '#0f0';
        const valueText = `${Math.round(value)} / ${max}`;
        this.ctx.fillText(valueText, x + barWidth + 10, y + barHeight - 2);
    }

    _drawMissileIcon(x, y, color) {
        this.ctx.save();
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + 3, y + 4);
        this.ctx.lineTo(x + 3, y + 10);
        this.ctx.lineTo(x + 5, y + 12);
        this.ctx.lineTo(x + 5, y + 14);
        this.ctx.lineTo(x - 5, y + 14);
        this.ctx.lineTo(x - 5, y + 12);
        this.ctx.lineTo(x - 3, y + 10);
        this.ctx.lineTo(x - 3, y + 4);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
}