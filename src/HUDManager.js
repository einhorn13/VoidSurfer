import { serviceLocator } from './ServiceLocator.js';

/**
 * Manages rendering the 2D canvas Heads-Up Display.
 */
export class HUDManager {
    constructor(scanner, dataManager, ecsWorld) {
        this.dataManager = dataManager;
        this.ecsWorld = ecsWorld;
        this.scanner = scanner;
        this.navigationService = serviceLocator.get('NavigationService');
        
        this.canvas = document.getElementById('hud-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.abilitiesContainer = document.getElementById('abilities-container');
        this.abilityElements = {};
        
        this.targetDisplay = document.getElementById('target-display');
        this.targetNameEl = document.getElementById('target-name');
        this.targetFactionEl = document.getElementById('target-faction');
        this.targetDistanceEl = document.getElementById('target-distance');
        this.targetSpeedEl = document.getElementById('target-speed');
        this.targetHealthBarsEl = document.getElementById('target-health-bars');

        this.driftConfig = this.dataManager.getConfig('game_balance').playerAbilities.drift;

        this._initDOM();
    }

    _initDOM() {
        if (!this.canvas) return;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * dpr;
        this.canvas.height = this.canvas.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);
        
        this._createAbilityElements();
    }

    _createAbilityElements() {
        if (!this.abilitiesContainer) return;
        this.abilitiesContainer.innerHTML = '';

        const createBar = (id, labelText) => {
            const bar = document.createElement('div');
            bar.className = 'ability-bar';
            bar.style.display = 'none';
            
            const label = document.createElement('span');
            label.className = 'ability-label';
            label.textContent = labelText;
            
            const container = document.createElement('div');
            container.className = 'ability-progress-container';
            
            const fill = document.createElement('div');
            fill.className = 'ability-progress-fill';
            
            container.appendChild(fill);
            bar.appendChild(label);
            bar.appendChild(container);
            
            this.abilitiesContainer.appendChild(bar);
            return { bar, label, fill };
        };

        this.abilityElements.gcd = createBar('gcd', 'Ship Systems');
        this.abilityElements.drift = createBar('drift', 'Drift [C]');
    }

    update(playerEntityId) {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._updateTargetDisplay();
        
        if (playerEntityId === null || !this.ecsWorld.hasEntity(playerEntityId)) {
            if (this.abilitiesContainer) {
                this.abilityElements.gcd.bar.style.display = 'none';
                this.abilityElements.drift.bar.style.display = 'none';
            }
            return;
        }
        
        const health = this.ecsWorld.getComponent(playerEntityId, 'HealthComponent');
        const stats = this.ecsWorld.getComponent(playerEntityId, 'PlayerStatsComponent');
        if (!health || !stats || health.state !== 'ALIVE') {
             if (health && health.state !== 'ALIVE') {
                this.ctx.font = 'bold 24px "Courier New", Courier, monospace';
                this.ctx.fillStyle = '#f00';
                this.ctx.fillText('SHIP DESTROYED', 10, 40);
                this.ctx.font = '14px "Courier New", Courier, monospace';
                this.ctx.fillStyle = '#0f0';
                this.ctx.fillText(`Credits: ${stats.credits} CR`, 10, 80);
            }
             if (this.abilitiesContainer) {
                this.abilityElements.gcd.bar.style.display = 'none';
                this.abilityElements.drift.bar.style.display = 'none';
            }
            return;
        }

        const physics = this.ecsWorld.getComponent(playerEntityId, 'PhysicsComponent');
        const energy = this.ecsWorld.getComponent(playerEntityId, 'EnergyComponent');
        const stateComp = this.ecsWorld.getComponent(playerEntityId, 'StateComponent');
        if (!physics || !energy || !stateComp) return;

        const speed = Math.round(physics.velocity.length());
        this.ctx.font = '14px "Courier New", Courier, monospace';
        this.ctx.fillStyle = '#0f0';
        this.ctx.fillText(`Speed: ${speed} m/s`, 10, 20);
        this.ctx.fillText(`Credits: ${stats.credits} CR`, 200, 20);

        this._drawBar(30, 'Shield', health.shield.current, health.shield.max, '#00aaff');
        this._drawBar(48, 'Hull', health.hull.current, health.hull.max, '#ffaa00');
        this._drawBar(66, 'Energy', energy.current, energy.max, '#ffff00');
        
        this._drawWeaponList(playerEntityId);
        this._updateAbilityStatusDOM(stateComp);
    }
    
    _updateAbilityStatusDOM(stateComp) {
        if (!this.abilitiesContainer || !this.abilityElements.gcd) return;

        const updateElement = (el, labelText, ratio, color, isVisible) => {
            if (isVisible) {
                el.bar.style.display = 'flex';
                el.label.textContent = labelText;
                el.label.style.color = color;
                el.fill.style.width = `${ratio * 100}%`;
                el.fill.style.backgroundColor = color;
            } else {
                el.bar.style.display = 'none';
            }
        };

        const gcdState = stateComp.states.get('GLOBAL_COOLDOWN');
        const gcdVisible = !!gcdState;
        const gcdRatio = gcdState ? 1.0 - (gcdState.timeLeft / gcdState.duration) : 0;
        updateElement(this.abilityElements.gcd, 'Ship Systems', gcdRatio, '#ffaa00', gcdVisible);

        const driftActiveState = stateComp.states.get('DRIFT_ACTIVE');
        const driftCooldownState = stateComp.states.get('DRIFT_COOLDOWN');
        
        let driftLabel = 'Drift [C]';
        let driftRatio = 0;
        let driftColor = '#00ff00';
        
        if (driftActiveState) {
            driftLabel += ' Active';
            driftRatio = driftActiveState.timeLeft / driftActiveState.duration;
            driftColor = '#00aaff';
        } else if (driftCooldownState) {
            driftLabel += ' CD';
            driftRatio = 1.0 - (driftCooldownState.timeLeft / driftCooldownState.duration);
            driftColor = '#888888';
        } else {
            driftLabel += ' Ready';
            driftRatio = 1.0;
            driftColor = '#00ff00';
        }
        updateElement(this.abilityElements.drift, driftLabel, driftRatio, driftColor, true);
    }

    _updateTargetDisplay() {
        if (!this.targetDisplay) return;

        const targetInfo = this.navigationService.getCurrentTargetInfo();
        
        if (targetInfo === null) {
            if (this.targetDisplay.style.display !== 'none') this.targetDisplay.style.display = 'none';
            return;
        }

        if (this.targetDisplay.style.display !== 'block') this.targetDisplay.style.display = 'block';

        this.targetNameEl.textContent = targetInfo.name;
        this.targetDistanceEl.textContent = `${Math.round(targetInfo.distance)}m`;
        this.targetSpeedEl.textContent = `${targetInfo.speed}m/s`;

        this.targetFactionEl.textContent = targetInfo.faction.replace('_FACTION', '');
        this.targetFactionEl.className = `target-faction faction-${targetInfo.relation}`;

        let healthHTML = '';
        if (targetInfo.health) {
            const shieldPercent = targetInfo.health.shield.max > 0 ? (targetInfo.health.shield.current / targetInfo.health.shield.max) * 100 : 0;
            const hullPercent = targetInfo.health.hull.max > 0 ? (targetInfo.health.hull.current / targetInfo.health.hull.max) * 100 : 0;
            
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
        this.targetHealthBarsEl.innerHTML = healthHTML;
    }

    _drawWeaponList(playerEntityId) {
        let weaponY = 90;
        const lineHeight = 16;
        
        const hardpoints = this.ecsWorld.getComponent(playerEntityId, 'HardpointComponent');
        const ammo = this.ecsWorld.getComponent(playerEntityId, 'AmmoComponent');
        const stateComp = this.ecsWorld.getComponent(playerEntityId, 'StateComponent');
        if (!hardpoints || !ammo || !stateComp) return;

        hardpoints.hardpoints.forEach((hp, index) => {
            const weapon = hp.weapon;
            const isSelected = index === hardpoints.selectedWeaponIndex;
            
            let line = isSelected ? '> ' : '  ';
            
            this.ctx.fillStyle = isSelected ? '#0ff' : '#0f0';
            
            if (weapon.ammoType === 'MISSILE') {
                const ammoCount = ammo.ammo.get('MISSILE') || 0;
                const isOnCooldown = hp.cooldownLeft > 0 || (isSelected && stateComp.states.has('GLOBAL_COOLDOWN'));
                const iconColor = isOnCooldown ? '#ff0000' : '#0f0';
                
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
        if (!this.canvas) return;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * dpr;
        this.canvas.height = this.canvas.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);
    }
}