// src/StationUIManager.js
import { serviceLocator } from "./ServiceLocator.js";
import { eventBus } from "./EventBus.js";

/**
 * Manages all interactive station and shipyard menus.
 */
export class StationUIManager {
    constructor() {
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.dataManager = serviceLocator.get('DataManager');
        this.notificationManager = serviceLocator.get('NotificationManager');
        this.playerShipId = null;

        this.balanceConfig = this.dataManager.getConfig('game_balance');
        this.serviceCosts = this.balanceConfig.stationServices;

        this.dockPrompt = document.getElementById('dock-prompt');
        this.stationMenu = document.getElementById('station-menu');
        this.shipyardMenu = document.getElementById('shipyard-menu');
        this.shipyardList = document.getElementById('shipyard-list');
        this.marketMenu = document.getElementById('market-menu');
        this.marketList = document.getElementById('market-list');
        this.repairCostEl = document.getElementById('cost-repair');
        this.rearmCostEl = document.getElementById('cost-rearm');
        
        this._addEventListeners();
    }

    setPlayerShip(entityId) {
        this.playerShipId = entityId;
        if (this.gameStateManager.getCurrentState() === 'DOCKED') {
            this.updateStationMenuCosts();
        }
    }

    _addEventListeners() {
        document.getElementById('btn-repair').addEventListener('click', () => this.handleRepair());
        document.getElementById('btn-rearm').addEventListener('click', () => this.handleRearm());
        document.getElementById('btn-undock').addEventListener('click', () => eventBus.emit('undock_request'));
        document.getElementById('btn-shipyard').addEventListener('click', () => this.showShipyardMenu());
        document.getElementById('btn-shipyard-back').addEventListener('click', () => this.showStationMenu());
        document.getElementById('btn-market').addEventListener('click', () => this.showMarketMenu());
        document.getElementById('btn-market-back').addEventListener('click', () => this.showStationMenu());
    }

    toggleDockingPrompt(show) { this.dockPrompt.style.display = show ? 'block' : 'none'; }
    
    showStationMenu() { 
        this.stationMenu.style.display = 'flex'; 
        this.shipyardMenu.style.display = 'none'; 
        this.marketMenu.style.display = 'none';
        this.updateStationMenuCosts(); 
    }

    hideStationUI() { 
        this.stationMenu.style.display = 'none'; 
        this.shipyardMenu.style.display = 'none'; 
        this.marketMenu.style.display = 'none';
    }

    updateStationMenuCosts() {
        if (this.playerShipId === null || this.gameStateManager.getCurrentState() !== 'DOCKED') return;
        
        const health = this.ecsWorld.getComponent(this.playerShipId, 'HealthComponent');
        const ammo = this.ecsWorld.getComponent(this.playerShipId, 'AmmoComponent');
        const staticData = this.ecsWorld.getComponent(this.playerShipId, 'StaticDataComponent');
        if (!health || !ammo || !staticData) return;

        const repairCost = Math.round(health.hull.max - health.hull.current) * this.serviceCosts.repairCostPerHullPoint;
        
        let rearmCost = 0;
        const baseShipData = staticData.data;
        if (baseShipData.ammo) {
            for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
                const currentAmount = ammo.ammo.get(ammoType) || 0;
                const costPerUnit = this.serviceCosts.rearmCostPerAmmo[ammoType] || 0;
                rearmCost += (maxAmount - currentAmount) * costPerUnit;
            }
        }

        this.repairCostEl.textContent = `${repairCost} CR`;
        this.rearmCostEl.textContent = `${rearmCost} CR`;
    }

    handleRepair() {
        const health = this.ecsWorld.getComponent(this.playerShipId, 'HealthComponent');
        if (!health) return;

        const cost = Math.round(health.hull.max - health.hull.current) * this.serviceCosts.repairCostPerHullPoint;
        if (this.gameStateManager.removeCredits(cost)) {
            health.hull.current = health.hull.max;
            this.gameStateManager.updatePlayerShipState(this.playerShipId);
            this.updateStationMenuCosts();
            this.notificationManager.log('Hull repaired', 'success');
        }
    }

    handleRearm() {
        const ammo = this.ecsWorld.getComponent(this.playerShipId, 'AmmoComponent');
        const staticData = this.ecsWorld.getComponent(this.playerShipId, 'StaticDataComponent');
        if (!ammo || !staticData) return;

        let totalCost = 0;
        const baseShipData = staticData.data;
        if (!baseShipData || !baseShipData.ammo) return;

        for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
            const currentAmount = ammo.ammo.get(ammoType) || 0;
            const costPerUnit = this.serviceCosts.rearmCostPerAmmo[ammoType] || 0;
            totalCost += (maxAmount - currentAmount) * costPerUnit;
        }

        if (totalCost > 0 && this.gameStateManager.removeCredits(totalCost)) {
            for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
                ammo.ammo.set(ammoType, maxAmount);
            }
            this.gameStateManager.updatePlayerShipState(this.playerShipId);
            this.updateStationMenuCosts();
            this.notificationManager.log('Ammunition rearmed', 'success');
        }
    }

    showMarketMenu() {
        this.stationMenu.style.display = 'none';
        this.marketMenu.style.display = 'flex';
        this.populateMarket();
    }

    populateMarket() {
        this.marketList.innerHTML = '';
        const cargo = this.ecsWorld.getComponent(this.playerShipId, 'CargoComponent');
        if (!cargo || cargo.items.size === 0) {
            this.marketList.innerHTML = '<li>Your cargo hold is empty.</li>';
            return;
        }

        cargo.items.forEach((quantity, itemId) => {
            const itemData = this.dataManager.getItemData(itemId);
            if (!itemData || !itemData.basePrice) return;

            const li = document.createElement('li');
            li.innerHTML = `
                <span>${itemData.name} (x${quantity})</span>
                <span>
                    <span style="margin-right: 15px;">${itemData.basePrice * quantity} CR</span>
                    <button data-item-id="${itemId}">Sell</button>
                </span>
            `;
            this.marketList.appendChild(li);
        });

        this.marketList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                this.handleSellItem(itemId);
            });
        });
    }

    handleSellItem(itemId) {
        if (this.playerShipId === null) return;
        
        const entityFactory = serviceLocator.get('EntityFactory');
        const cargo = this.ecsWorld.getComponent(this.playerShipId, 'CargoComponent');
        const quantity = cargo.items.get(itemId);
        const itemData = this.dataManager.getItemData(itemId);

        if (!quantity || !itemData || !itemData.basePrice) return;

        cargo.items.delete(itemId);
        entityFactory.ship.updateMassAndPerformance(this.playerShipId);

        const creditsEarned = quantity * itemData.basePrice;
        this.gameStateManager.addCredits(creditsEarned);
        this.gameStateManager.updatePlayerShipState(this.playerShipId);
        eventBus.emit('notification', { text: `Sold ${quantity}x ${itemData.name} for ${creditsEarned} CR`, type: 'success' });
        
        this.populateMarket();
    }

    showShipyardMenu() {
        this.stationMenu.style.display = 'none';
        this.shipyardMenu.style.display = 'flex';
        this.populateShipyard();
    }

    populateShipyard() {
        this.shipyardList.innerHTML = '';
        const staticData = this.ecsWorld.getComponent(this.playerShipId, 'StaticDataComponent');
        if (!staticData) return;
        
        this.dataManager.ships.forEach(shipData => {
            if (shipData.faction !== 'PLAYER_FACTION') return;
            
            const isOwned = staticData.data.id === shipData.id;
            const canAfford = this.gameStateManager.playerState.credits >= shipData.cost;
            const li = document.createElement('li');
            li.innerHTML = `<span>${shipData.name} (${shipData.cost} CR)</span>
                <button data-ship-id="${shipData.id}" ${isOwned || !canAfford ? 'disabled' : ''}>${isOwned ? 'Owned' : 'Purchase'}</button>`;
            this.shipyardList.appendChild(li);
        });
        this.shipyardList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const shipId = e.target.dataset.shipId;
                eventBus.emit('purchase_ship_request', shipId);
            });
        });
    }
}