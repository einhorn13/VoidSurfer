import { serviceLocator } from "./ServiceLocator.js";
import { eventBus } from "./EventBus.js";

/**
 * Manages all interactive station and shipyard menus.
 */
export class StationUIManager {
    constructor(notificationManager) {
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.dataManager = serviceLocator.get('DataManager');
        this.notificationManager = notificationManager;
        this.playerShipId = null;

        this.balanceConfig = this.dataManager.getConfig('game_balance');
        this.serviceCosts = this.balanceConfig.stationServices;

        this.dockPrompt = document.getElementById('dock-prompt');
        this.stationMenu = document.getElementById('station-menu');
        this.shipyardMenu = document.getElementById('shipyard-menu');
        this.shipyardList = document.getElementById('shipyard-list');
        this.marketMenu = document.getElementById('market-menu');
        this.marketList = document.getElementById('market-list');
        this.workshopMenu = document.getElementById('workshop-menu');
        this.workshopStockList = document.getElementById('workshop-stock-list');
        this.workshopInventoryList = document.getElementById('workshop-inventory-list');

        this.repairCostEl = document.getElementById('cost-repair');
        this.rearmCostEl = document.getElementById('cost-rearm');
        this.repairDetailsEl = document.getElementById('details-repair');
        this.rearmDetailsEl = document.getElementById('details-rearm');
        this.comparisonTooltip = document.getElementById('ship-comparison-tooltip');
        
        this._addEventListeners();
    }

    setPlayerShip(entityId) {
        this.playerShipId = entityId;
        const gameStateManager = serviceLocator.get('GameStateManager');
        if (gameStateManager.getCurrentState() === 'DOCKED') {
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
        document.getElementById('btn-workshop').addEventListener('click', () => this.showWorkshopMenu());
        document.getElementById('btn-workshop-back').addEventListener('click', () => this.showStationMenu());

        eventBus.on('player_stats_updated', () => {
            const gameStateManager = serviceLocator.get('GameStateManager');
            if (gameStateManager.getCurrentState() === 'DOCKED') {
                if (this.shipyardMenu.style.display === 'flex') this.populateShipyard();
                if (this.stationMenu.style.display === 'flex') this.updateStationMenuCosts();
                if (this.workshopMenu.style.display === 'flex') this.populateWorkshop();
            }
        });
        eventBus.on('player_ship_updated', (entityId) => {
            this.setPlayerShip(entityId);
             const gameStateManager = serviceLocator.get('GameStateManager');
            if (gameStateManager.getCurrentState() === 'DOCKED') {
                 if (this.shipyardMenu.style.display === 'flex') this.populateShipyard();
                 if (this.workshopMenu.style.display === 'flex') this.populateWorkshop();
            }
        });
    }

    toggleDockingPrompt(show) { this.dockPrompt.style.display = show ? 'block' : 'none'; }
    
    showStationMenu() { 
        this.stationMenu.style.display = 'flex'; 
        this.shipyardMenu.style.display = 'none'; 
        this.marketMenu.style.display = 'none';
        this.workshopMenu.style.display = 'none';
        this.updateStationMenuCosts(); 
    }

    hideStationUI() { 
        this.stationMenu.style.display = 'none'; 
        this.shipyardMenu.style.display = 'none'; 
        this.marketMenu.style.display = 'none';
        this.workshopMenu.style.display = 'none';
        this.comparisonTooltip.style.display = 'none';
    }

    updateStationMenuCosts() {
        const gameStateManager = serviceLocator.get('GameStateManager');
        if (this.playerShipId === null || gameStateManager.getCurrentState() !== 'DOCKED') return;
        
        const health = this.ecsWorld.getComponent(this.playerShipId, 'HealthComponent');
        const ammo = this.ecsWorld.getComponent(this.playerShipId, 'AmmoComponent');
        const staticData = this.ecsWorld.getComponent(this.playerShipId, 'StaticDataComponent');
        if (!health || !ammo || !staticData) return;

        const repairCost = Math.round(health.hull.max - health.hull.current) * this.serviceCosts.repairCostPerHullPoint;
        this.repairCostEl.textContent = `${repairCost} CR`;
        this.repairDetailsEl.textContent = `(${Math.round(health.hull.current)}/${health.hull.max} HP)`;
        
        let rearmCost = 0;
        let ammoToRearm = 0;
        const baseShipData = staticData.data;
        if (baseShipData.ammo) {
            for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
                const currentAmount = ammo.ammo.get(ammoType) || 0;
                const costPerUnit = this.serviceCosts.rearmCostPerAmmo[ammoType] || 0;
                rearmCost += (maxAmount - currentAmount) * costPerUnit;
                ammoToRearm += (maxAmount - currentAmount);
            }
        }
        this.rearmCostEl.textContent = `${rearmCost} CR`;
        this.rearmDetailsEl.textContent = ammoToRearm > 0 ? `(Missing ${ammoToRearm} units)` : `(Fully stocked)`;
    }

    handleRepair() {
        const health = this.ecsWorld.getComponent(this.playerShipId, 'HealthComponent');
        const stats = this.ecsWorld.getComponent(this.playerShipId, 'PlayerStatsComponent');
        if (!health || !stats) return;

        const cost = Math.round(health.hull.max - health.hull.current) * this.serviceCosts.repairCostPerHullPoint;
        if (stats.credits >= cost) {
            stats.credits -= cost;
            health.hull.current = health.hull.max;
            eventBus.emit('player_stats_updated');
            this.notificationManager.log('Hull repaired', 'success');
        }
    }

    handleRearm() {
        const ammo = this.ecsWorld.getComponent(this.playerShipId, 'AmmoComponent');
        const staticData = this.ecsWorld.getComponent(this.playerShipId, 'StaticDataComponent');
        const stats = this.ecsWorld.getComponent(this.playerShipId, 'PlayerStatsComponent');
        if (!ammo || !staticData || !stats) return;

        let totalCost = 0;
        const baseShipData = staticData.data;
        if (!baseShipData || !baseShipData.ammo) return;

        for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
            const currentAmount = ammo.ammo.get(ammoType) || 0;
            const costPerUnit = this.serviceCosts.rearmCostPerAmmo[ammoType] || 0;
            totalCost += (maxAmount - currentAmount) * costPerUnit;
        }

        if (totalCost > 0 && stats.credits >= totalCost) {
            stats.credits -= totalCost;
            for (const [ammoType, maxAmount] of Object.entries(baseShipData.ammo)) {
                ammo.ammo.set(ammoType, maxAmount);
            }
            eventBus.emit('player_stats_updated');
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
                <span>${itemData.name} (x${quantity}) - ${itemData.basePrice} CR/unit</span>
                <div class="market-actions">
                    <input type="number" value="1" min="1" max="${quantity}" data-item-id="${itemId}-qty">
                    <button data-item-id="${itemId}" data-action="sell-qty">Sell</button>
                    <button data-item-id="${itemId}" data-action="sell-all">Sell All</button>
                </div>
            `;
            this.marketList.appendChild(li);
        });

        this.marketList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.target.dataset.itemId;
                const action = e.target.dataset.action;
                if (action === 'sell-all') {
                    const quantity = cargo.items.get(itemId);
                    this.handleSellItems(itemId, quantity);
                } else if (action === 'sell-qty') {
                    const input = this.marketList.querySelector(`input[data-item-id="${itemId}-qty"]`);
                    const quantity = parseInt(input.value, 10);
                    this.handleSellItems(itemId, quantity);
                }
            });
        });
    }

    handleSellItems(itemId, quantityToSell) {
        if (this.playerShipId === null || !itemId || !quantityToSell || quantityToSell <= 0) return;
        
        const entityFactory = serviceLocator.get('EntityFactory');
        const cargo = this.ecsWorld.getComponent(this.playerShipId, 'CargoComponent');
        const stats = this.ecsWorld.getComponent(this.playerShipId, 'PlayerStatsComponent');
        
        const currentQuantity = cargo.items.get(itemId);
        const itemData = this.dataManager.getItemData(itemId);

        if (!cargo || !stats || !currentQuantity || !itemData) return;

        const amountToSell = Math.min(quantityToSell, currentQuantity);
        
        if (amountToSell < currentQuantity) {
            cargo.items.set(itemId, currentQuantity - amountToSell);
        } else {
            cargo.items.delete(itemId);
        }
        
        const massRemoved = (itemData.mass || 0) * amountToSell;
        cargo.currentMass -= massRemoved;
        
        entityFactory.ship.updateMassAndPerformance(this.playerShipId);

        const creditsEarned = amountToSell * (itemData.basePrice || 0);
        stats.credits += creditsEarned;
        eventBus.emit('player_stats_updated');
        
        eventBus.emit('notification', { text: `Sold ${amountToSell}x ${itemData.name} for ${creditsEarned} CR`, type: 'success' });
        
        this.populateMarket();
    }

    showShipyardMenu() {
        this.stationMenu.style.display = 'none';
        this.shipyardMenu.style.display = 'flex';
        this.populateShipyard();
    }

    populateShipyard() {
        this.shipyardList.innerHTML = '';
        if (this.playerShipId === null) return;
        
        const staticData = this.ecsWorld.getComponent(this.playerShipId, 'StaticDataComponent');
        const stats = this.ecsWorld.getComponent(this.playerShipId, 'PlayerStatsComponent');
        if (!staticData || !stats) return;
        
        this.dataManager.ships.forEach(shipData => {
            if (shipData.faction !== 'PLAYER_FACTION' || !shipData.cost) return;
            
            const isOwned = staticData.data.id === shipData.id;
            const canAfford = stats.credits >= shipData.cost;
            const li = document.createElement('li');
            li.innerHTML = `<span>${shipData.name} (${shipData.cost} CR)</span>
                <button data-ship-id="${shipData.id}" ${isOwned || !canAfford ? 'disabled' : ''}>${isOwned ? 'Owned' : 'Purchase'}</button>`;
            
            li.addEventListener('mouseenter', (e) => this._showShipComparison(shipData.id, e));
            li.addEventListener('mouseleave', () => this._hideShipComparison());
            li.addEventListener('mousemove', (e) => this._updateTooltipPosition(e));

            this.shipyardList.appendChild(li);
        });
        
        this.shipyardList.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                const shipId = e.target.dataset.shipId;
                eventBus.emit('purchase_ship_request', shipId);
            });
        });
    }

    _showShipComparison(targetShipId, event) {
        const currentShipStatic = this.ecsWorld.getComponent(this.playerShipId, 'StaticDataComponent').data;
        const targetShipStatic = this.dataManager.getShipData(targetShipId);

        const formatComparison = (label, current, target, higherIsBetter = true, fixed = 0) => {
            const diff = target - current;
            const diffSign = diff > 0 ? '+' : '';
            const diffText = Math.abs(diff) > 1e-6 ? ` (${diffSign}${diff.toFixed(fixed)})` : '';
            
            let className = '';
            if (diff !== 0) {
                if ((diff > 0 && higherIsBetter) || (diff < 0 && !higherIsBetter)) {
                    className = 'improved';
                } else {
                    className = 'worsened';
                }
            }
            return `<tr><td>${label}</td><td class="${className}">${target.toFixed(fixed)}${diffText}</td></tr>`;
        };

        const currentShieldData = this.dataManager.getShieldData(currentShipStatic.shieldSlot.equipped);
        const targetShieldData = this.dataManager.getShieldData(targetShipStatic.shieldSlot.equipped);
        const currentEngineData = this.dataManager.getEngineData(currentShipStatic.engineSlot.equipped);
        const targetEngineData = this.dataManager.getEngineData(targetShipStatic.engineSlot.equipped);

        let content = `<h4>${targetShipStatic.name}</h4><table>`;
        content += formatComparison('Hull', currentShipStatic.hull, targetShipStatic.hull);
        content += formatComparison('Shield', currentShieldData.capacity, targetShieldData.capacity);
        content += formatComparison('Energy', currentShipStatic.energy, targetShipStatic.energy);
        content += formatComparison('Turn Speed', currentShipStatic.turnSpeed, targetShipStatic.turnSpeed, true, 1);
        content += formatComparison('Max Speed', currentEngineData.maxSpeed, targetEngineData.maxSpeed);
        content += formatComparison('Cargo', currentShipStatic.cargoCapacity, targetShipStatic.cargoCapacity);
        content += `</table>`;

        this.comparisonTooltip.innerHTML = content;
        this.comparisonTooltip.style.display = 'block';
        this._updateTooltipPosition(event);
    }

    _hideShipComparison() {
        this.comparisonTooltip.style.display = 'none';
    }

    _updateTooltipPosition(event) {
        this.comparisonTooltip.style.left = `${event.clientX + 15}px`;
        this.comparisonTooltip.style.top = `${event.clientY + 15}px`;
    }

    showWorkshopMenu() {
        this.stationMenu.style.display = 'none';
        this.workshopMenu.style.display = 'flex';
        this.populateWorkshop();
    }
    
    populateWorkshop() {
        this.workshopStockList.innerHTML = '';
        this.workshopInventoryList.innerHTML = '';

        const stats = this.ecsWorld.getComponent(this.playerShipId, 'PlayerStatsComponent');
        const stock = this.serviceCosts.workshopStock || [];
        stock.forEach(itemId => {
            const itemData = this.dataManager.getWeaponData(itemId) || this.dataManager.getEngineData(itemId) || this.dataManager.getShieldData(itemId);
            if (itemData) {
                const canAfford = stats.credits >= itemData.cost;
                const li = document.createElement('li');
                li.innerHTML = `<span>${itemData.name} (${itemData.cost} CR)</span>
                              <button data-item-id="${itemId}" data-type="stock" ${!canAfford ? 'disabled' : ''}>Buy</button>`;
                this.workshopStockList.appendChild(li);
            }
        });
        if (this.workshopStockList.children.length === 0) this.workshopStockList.innerHTML = '<li>No equipment in stock.</li>';

        const inventory = this.ecsWorld.getComponent(this.playerShipId, 'PlayerInventoryComponent');
        let hasItems = false;
        const addInventoryItems = (items, type) => {
            items.forEach((count, itemId) => {
                const itemData = this._getModuleData(itemId, type);
                const li = document.createElement('li');
                li.innerHTML = `<span>${itemData.name} (x${count})</span>
                              <div>
                                <button data-item-id="${itemId}" data-type="${type}" data-action="equip">Equip</button>
                                <button data-item-id="${itemId}" data-type="${type}" data-action="sell">Sell</button>
                              </div>`;
                this.workshopInventoryList.appendChild(li);
                hasItems = true;
            });
        };
        addInventoryItems(inventory.weapons, 'weapon');
        addInventoryItems(inventory.shields, 'shield');
        addInventoryItems(inventory.engines, 'engine');
        if (!hasItems) this.workshopInventoryList.innerHTML = '<li>Inventory is empty.</li>';

        this.workshopMenu.querySelectorAll('button').forEach(button => {
             button.addEventListener('click', (e) => {
                const { itemId, type, action } = e.target.dataset;
                if (type === 'stock') this.handleBuyModule(itemId);
                else if (action === 'sell') this.handleSellModule(itemId, type);
                else if (action === 'equip') this.handleEquipModule(itemId, type);
            });
        });
    }

    handleBuyModule(itemId) {
        const itemData = this._getModuleData(itemId);
        const stats = this.ecsWorld.getComponent(this.playerShipId, 'PlayerStatsComponent');
        const inventory = this.ecsWorld.getComponent(this.playerShipId, 'PlayerInventoryComponent');
        if (!itemData || !stats || !inventory || stats.credits < itemData.cost) return;

        stats.credits -= itemData.cost;
        
        let inventoryMap;
        if (this.dataManager.getWeaponData(itemId)) inventoryMap = inventory.weapons;
        else if (this.dataManager.getEngineData(itemId)) inventoryMap = inventory.engines;
        else if (this.dataManager.getShieldData(itemId)) inventoryMap = inventory.shields;
        
        inventoryMap.set(itemId, (inventoryMap.get(itemId) || 0) + 1);
        
        this.notificationManager.log(`Purchased ${itemData.name}`, 'success');
        eventBus.emit('player_stats_updated');
    }

    handleSellModule(itemId, itemType) {
        const itemData = this._getModuleData(itemId, itemType);
        const stats = this.ecsWorld.getComponent(this.playerShipId, 'PlayerStatsComponent');
        const inventory = this.ecsWorld.getComponent(this.playerShipId, 'PlayerInventoryComponent');
        if (!itemData || !stats || !inventory) return;

        const inventoryMap = inventory[`${itemType}s`];
        const currentCount = inventoryMap.get(itemId) || 0;
        if (currentCount <= 0) return;

        inventoryMap.set(itemId, currentCount - 1);
        if (inventoryMap.get(itemId) === 0) {
            inventoryMap.delete(itemId);
        }

        stats.credits += itemData.cost * 0.5; // Sell for 50% of base price
        
        this.notificationManager.log(`Sold ${itemData.name}`, 'success');
        eventBus.emit('player_stats_updated');
    }

    handleEquipModule(itemId, itemType) {
        const staticData = this.ecsWorld.getComponent(this.playerShipId, 'StaticDataComponent');
        const inventory = this.ecsWorld.getComponent(this.playerShipId, 'PlayerInventoryComponent');
        if (!staticData || !inventory) return;

        const inventoryMap = inventory[`${itemType}s`];
        const currentCount = inventoryMap.get(itemId) || 0;
        if (currentCount <= 0) return;

        let slotPath;
        if (itemType === 'engine') slotPath = 'engineSlot';
        else if (itemType === 'shield') slotPath = 'shieldSlot';
        // Simplified: for weapons, we just swap the first hardpoint for now.
        else if (itemType === 'weapon') slotPath = 'hardpoints[0]';
        
        if (!slotPath) return;

        // Unequip current module and add to inventory
        const shipData = staticData.data;
        const oldItemId = itemType === 'weapon' ? shipData.hardpoints[0].equipped : shipData[slotPath].equipped;
        if (oldItemId) {
            const oldItemData = this._getModuleData(oldItemId);
            const oldItemType = oldItemData.slotType ? 'weapon' : (oldItemData.capacity ? 'shield' : 'engine');
            const oldInventoryMap = inventory[`${oldItemType}s`];
            oldInventoryMap.set(oldItemId, (oldInventoryMap.get(oldItemId) || 0) + 1);
        }

        // Equip new module from inventory
        inventoryMap.set(itemId, currentCount - 1);
        if (inventoryMap.get(itemId) === 0) inventoryMap.delete(itemId);
        
        if (itemType === 'weapon') shipData.hardpoints[0].equipped = itemId;
        else shipData[slotPath].equipped = itemId;

        // Re-initialize hardpoints and recalculate performance
        const hardpoints = this.ecsWorld.getComponent(this.playerShipId, 'HardpointComponent');
        hardpoints.constructor(shipData.hardpoints); // Re-run constructor
        
        const entityFactory = serviceLocator.get('EntityFactory');
        entityFactory.ship.updateMassAndPerformance(this.playerShipId);

        this.notificationManager.log(`Equipped ${this._getModuleData(itemId, itemType).name}`, 'success');
        eventBus.emit('player_ship_updated', this.playerShipId);
    }

    _getModuleData(itemId, itemType) {
        if (itemType === 'weapon') return this.dataManager.getWeaponData(itemId);
        if (itemType === 'engine') return this.dataManager.getEngineData(itemId);
        if (itemType === 'shield') return this.dataManager.getShieldData(itemId);
        return this.dataManager.getWeaponData(itemId) || this.dataManager.getEngineData(itemId) || this.dataManager.getShieldData(itemId);
    }
}