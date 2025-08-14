// src/UIManager.js
import * as THREE from 'three';

const REPAIR_COST_PER_PT = 2;
const REARM_COST_PER_AMMO_TYPE = {
    'PROJECTILE': 1,
    'MISSILE': 100
};
const MAX_SCANNER_TARGETS = 50;

export class UIManager {
    constructor(gameStateManager, dockAction, undockAction, shipyardAction, dataManager) {
        this.gameStateManager = gameStateManager;
        this.shipyardAction = shipyardAction;
        this.dataManager = dataManager;
        this.playerShip = null;

        this.hudCanvas = document.getElementById('hud-canvas');
        this.hudCtx = this.hudCanvas.getContext('2d');
        this.hudCanvas.width = this.hudCanvas.clientWidth * window.devicePixelRatio;
        this.hudCanvas.height = this.hudCanvas.clientHeight * window.devicePixelRatio;
        this.hudCtx.scale(window.devicePixelRatio, window.devicePixelRatio);

        this.dockPrompt = document.getElementById('dock-prompt');
        this.stationMenu = document.getElementById('station-menu');
        this.shipyardMenu = document.getElementById('shipyard-menu');
        this.shipyardList = document.getElementById('shipyard-list');
        this.scannerContainer = document.getElementById('scanner-container');
        this.navPointer = document.getElementById('nav-pointer');
        this.damageOverlay = document.getElementById('damage-overlay');
        this.mouseCursor = document.getElementById('mouse-cursor');

        this.repairCostEl = document.getElementById('cost-repair');
        this.rearmCostEl = document.getElementById('cost-rearm');

        this.scannerTargetPool = [];
        this._initScannerPool();

        document.getElementById('btn-repair').addEventListener('click', () => this.handleRepair());
        document.getElementById('btn-rearm').addEventListener('click', () => this.handleRearm());
        document.getElementById('btn-undock').addEventListener('click', undockAction);
        document.getElementById('btn-shipyard').addEventListener('click', () => this.showShipyardMenu());
        document.getElementById('btn-shipyard-back').addEventListener('click', () => this.showStationMenu());

        window.addEventListener('mousemove', (e) => {
            this.mouseCursor.style.left = `${e.clientX}px`;
            this.mouseCursor.style.top = `${e.clientY}px`;
        });
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

    setPlayerShip(playerShip) { this.playerShip = playerShip; }

    _drawBar(y, label, value, max, color) {
        const barWidth = 150;
        const barHeight = 12;
        const x = 80;
        const percent = max > 0 ? value / max : 0;
        const filledWidth = barWidth * percent;

        this.hudCtx.fillStyle = '#0f0';
        this.hudCtx.fillText(label, 10, y + barHeight - 2);
        this.hudCtx.fillStyle = '#050';
        this.hudCtx.fillRect(x, y, barWidth, barHeight);
        this.hudCtx.fillStyle = color;
        this.hudCtx.fillRect(x, y, filledWidth, barHeight);
        this.hudCtx.strokeStyle = '#0f0';
        this.hudCtx.strokeRect(x, y, barWidth, barHeight);
        this.hudCtx.fillStyle = '#0f0';
        const valueText = `${Math.round(value)} / ${max}`;
        this.hudCtx.fillText(valueText, x + barWidth + 10, y + barHeight - 2);
    }

    updateHud() {
        if (!this.playerShip) return;

        this.mouseCursor.style.display = this.gameStateManager.isConsoleOpen ? 'none' : 'block';

        const ctx = this.hudCtx;
        ctx.clearRect(0, 0, this.hudCanvas.width, this.hudCanvas.height);
        ctx.font = '14px "Courier New", Courier, monospace';
        ctx.fillStyle = '#0f0';

        if (this.playerShip.isDestroyed) {
            ctx.font = 'bold 24px "Courier New", Courier, monospace';
            ctx.fillStyle = '#f00';
            ctx.fillText('SHIP DESTROYED', 10, 40);
            ctx.font = '14px "Courier New", Courier, monospace';
            ctx.fillStyle = '#0f0';
            ctx.fillText(`Credits: ${this.gameStateManager.playerState.credits} CR`, 10, 80);
            return;
        }

        const speed = Math.round(this.playerShip.velocity.length());
        ctx.fillText(`Speed: ${speed} m/s`, 10, 20);
        ctx.fillText(`Credits: ${this.gameStateManager.playerState.credits} CR`, 200, 20);

        this._drawBar(30, 'Shield', this.playerShip.shield, this.playerShip.maxShield, '#00aaff');
        this._drawBar(48, 'Hull', this.playerShip.hull, this.playerShip.maxHull, '#ffaa00');
        this._drawBar(66, 'Energy', this.playerShip.energy, this.playerShip.maxEnergy, '#ffff00');

        this.playerShip.hardpoints.forEach((hp, index) => {
            const weaponName = hp.weapon.name;
            if (index === this.playerShip.selectedWeaponIndex) {
                ctx.fillStyle = '#0ff';
                ctx.fillText(`[${index + 1}:${weaponName}]`, 10 + index * 130, 95);
            } else {
                ctx.fillStyle = '#0f0';
                ctx.fillText(`[${index + 1}:${weaponName}]`, 10 + index * 130, 95);
            }
        });
        ctx.fillStyle = '#0f0';

        const AMMO_DATA = this.dataManager.getMiscData('AMMO_DATA');
        const currentWeapon = this.playerShip.getCurrentWeapon();
        if (currentWeapon && currentWeapon.ammoType) {
            const ammoType = currentWeapon.ammoType;
            const ammoCount = this.playerShip.ammo.get(ammoType) || 0;
            const ammoName = AMMO_DATA[ammoType].name;
            ctx.fillText(`${ammoName}: ${ammoCount}`, 10, 115);
        } else {
            ctx.fillText('Ammo: ---', 10, 115);
        }

        const cargoItems = Array.from(this.playerShip.cargoHold.entries());
        const currentLoad = cargoItems.reduce((sum, [, qty]) => sum + qty, 0);
        let cargoStr = `Cargo: [${currentLoad}/${this.playerShip.maxCargo}]`;
        if (cargoItems.length > 0) {
            cargoStr += ' ' + cargoItems.map(([id, qty]) => {
                const itemName = this.dataManager.getItemData(id)?.name || 'Unknown';
                return `${itemName.slice(0,4)}:${qty}`;
            }).join(', ');
        }
        ctx.fillText(cargoStr, 10, 135);
    }

    showDamageFlash() {
        this.damageOverlay.style.opacity = '0.7';
        setTimeout(() => { this.damageOverlay.style.opacity = '0'; }, 100);
    }

    toggleDockingPrompt(show) { this.dockPrompt.style.display = show ? 'block' : 'none'; }
    showStationMenu() { this.stationMenu.style.display = 'flex'; this.shipyardMenu.style.display = 'none'; this.updateStationMenuCosts(); }
    hideStationUI() { this.stationMenu.style.display = 'none'; this.shipyardMenu.style.display = 'none'; }

    updateStationMenuCosts() {
        if (!this.playerShip || !this.gameStateManager.isDocked) return;
        
        const repairCost = Math.round(this.playerShip.maxHull - this.playerShip.hull) * REPAIR_COST_PER_PT;
        
        let rearmCost = 0;
        const baseShipData = this.dataManager.getShipData(this.playerShip.id);
        if (baseShipData.ammo) {
            for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
                const currentAmount = this.playerShip.ammo.get(ammoType) || 0;
                const costPerUnit = REARM_COST_PER_AMMO_TYPE[ammoType] || 0;
                rearmCost += (maxAmount - currentAmount) * costPerUnit;
            }
        }

        this.repairCostEl.textContent = `${repairCost} CR`;
        this.rearmCostEl.textContent = `${rearmCost} CR`;
    }

    handleRepair() {
        const cost = Math.round(this.playerShip.maxHull - this.playerShip.hull) * REPAIR_COST_PER_PT;
        if (this.gameStateManager.removeCredits(cost)) {
            this.playerShip.hull = this.playerShip.maxHull;
            this.gameStateManager.updatePlayerShipState(this.playerShip);
            this.updateStationMenuCosts();
        }
    }

    handleRearm() {
        let totalCost = 0;
        const baseShipData = this.dataManager.getShipData(this.playerShip.id);
        if (!baseShipData.ammo) return;

        for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
            const currentAmount = this.playerShip.ammo.get(ammoType) || 0;
            const costPerUnit = REARM_COST_PER_AMMO_TYPE[ammoType] || 0;
            totalCost += (maxAmount - currentAmount) * costPerUnit;
        }

        if (this.gameStateManager.removeCredits(totalCost)) {
            for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
                this.playerShip.ammo.set(ammoType, maxAmount);
            }
            this.gameStateManager.updatePlayerShipState(this.playerShip);
            this.updateStationMenuCosts();
        }
    }

    showShipyardMenu() {
        this.stationMenu.style.display = 'none';
        this.shipyardMenu.style.display = 'flex';
        this.populateShipyard();
    }

    populateShipyard() {
        this.shipyardList.innerHTML = '';
        this.dataManager.ships.forEach(shipData => {
            if (shipData.faction !== 'PLAYER_FACTION') return;
            
            const isOwned = this.playerShip.id === shipData.id;
            const canAfford = this.gameStateManager.playerState.credits >= shipData.cost;
            const li = document.createElement('li');
            li.innerHTML = `<span>${shipData.name} (${shipData.cost} CR)</span>
                <button data-ship-id="${shipData.id}" ${isOwned || !canAfford ? 'disabled' : ''}>${isOwned ? 'Owned' : 'Purchase'}</button>`;
            this.shipyardList.appendChild(li);
        });
        this.shipyardList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const shipId = e.target.dataset.shipId;
                if (this.shipyardAction(shipId)) this.showStationMenu();
            });
        });
    }
    
    updateScanner(scanner, camera) {
        if (!scanner.playerShip) return;

        const relationshipColor = {
            'PIRATE_FACTION': 'red',
            'CIVILIAN_FACTION': 'white',
            'PLAYER_FACTION': 'lime'
        };
        let poolIndex = 0;

        scanner.targets.forEach(target => {
            if (poolIndex >= MAX_SCANNER_TARGETS) return;

            const screenPos = target.ship.getScreenPosition(camera);
            if (screenPos.z > 1) return;

            const targetUI = this.scannerTargetPool[poolIndex];
            const x = (screenPos.x + 1) / 2 * 100;
            const y = (-screenPos.y + 1) / 2 * 100;

            targetUI.box.style.left = `${x}%`;
            targetUI.box.style.top = `${y}%`;
            targetUI.box.style.borderColor = relationshipColor[target.ship.faction] || 'yellow';
            targetUI.box.style.display = 'block';

            targetUI.text.textContent = `${Math.round(target.distance)}m`;
            targetUI.text.style.left = `${x}%`;
            targetUI.text.style.top = `${y + 1.5}%`;
            targetUI.text.style.display = 'block';
            targetUI.text.style.color = relationshipColor[target.ship.faction] || 'yellow';
            
            poolIndex++;
        });

        for (let i = poolIndex; i < MAX_SCANNER_TARGETS; i++) {
            this.scannerTargetPool[i].box.style.display = 'none';
            this.scannerTargetPool[i].text.style.display = 'none';
        }

        if (scanner.navTarget) {
            let screenPos;
            if (typeof scanner.navTarget.getScreenPosition === 'function') {
                screenPos = scanner.navTarget.getScreenPosition(camera);
            } else if (scanner.navTarget.position) {
                const position = new THREE.Vector3();
                scanner.navTarget.getWorldPosition(position);
                screenPos = position.project(camera);
            }

            if (!screenPos || screenPos.z > 1) {
                this.navPointer.style.display = 'none';
            } else {
                this.navPointer.style.display = 'block';
                this.navPointer.style.left = `${(screenPos.x + 1) / 2 * 100}%`;
                this.navPointer.style.top = `${(-screenPos.y + 1) / 2 * 100}%`;
            }
        } else {
            this.navPointer.style.display = 'none';
        }
    }
}