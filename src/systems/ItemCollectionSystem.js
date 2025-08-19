// src/systems/ItemCollectionSystem.js
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { eventBus } from '../EventBus.js';

export class ItemCollectionSystem extends System {
    constructor(world) {
        super(world);
        this.dataManager = serviceLocator.get('DataManager');
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.gameStateManager = serviceLocator.get('GameStateManager');
    }

    update(delta) {
        const collectionEvents = this.world.getEvents('collection_collision');

        for (const event of collectionEvents) {
            const { collectorId, collectibleId } = event;

            const collectibleComp = this.world.getComponent(collectibleId, 'CollectibleComponent');
            const collectibleHealth = this.world.getComponent(collectibleId, 'HealthComponent');
            if (!collectibleComp || !collectibleHealth || collectibleHealth.isDestroyed) continue;
            
            const contents = collectibleComp.contents;
            let anythingCollected = false;

            // 1. Collect credits from salvage
            if (contents.credits > 0) {
                this.gameStateManager.addCredits(contents.credits);
                eventBus.emit('notification', { text: `+${contents.credits} CR (Salvage)`, type: 'success' });
                anythingCollected = true;
            }

            // 2. Collect items from salvage/drops
            if (contents.items && contents.items.length > 0) {
                contents.items.forEach(item => {
                    const pickedUp = this._addCargo(collectorId, item.itemId, item.quantity);
                    if (pickedUp > 0) {
                        const itemData = this.dataManager.getItemData(item.itemId);
                        const itemName = itemData ? itemData.name : 'Unknown Item';
                        eventBus.emit('notification', { text: `+${pickedUp} ${itemName}`, type: 'success' });
                        anythingCollected = true;
                    } else if (pickedUp === 0 && item.quantity > 0) {
                        eventBus.emit('notification', { text: 'Cargo hold full', type: 'info' });
                    }
                });
            }
            
            // 3. Mark the container for cleanup
            if (anythingCollected) {
                collectibleHealth.isDestroyed = true;
            }
        }
    }

    _addCargo(shipEntityId, itemId, quantity) {
        const cargo = this.world.getComponent(shipEntityId, 'CargoComponent');
        if (!cargo) return 0;

        let currentCargoMass = 0;
        cargo.items.forEach((qty, id) => {
            const itemData = this.dataManager.getItemData(id);
            currentCargoMass += (itemData?.mass || 0) * qty;
        });

        const itemDataToAdd = this.dataManager.getItemData(itemId);
        const massPerUnit = itemDataToAdd?.mass || 1;
        const remainingCapacity = cargo.capacity - currentCargoMass;
        if (remainingCapacity <= 0) return 0;

        const canAddByMass = Math.floor(remainingCapacity / massPerUnit);
        const canAdd = Math.min(quantity, canAddByMass);
        if (canAdd <= 0) return 0;

        const currentQuantity = cargo.items.get(itemId) || 0;
        cargo.items.set(itemId, currentQuantity + canAdd);
        
        // Update ship's performance based on new mass
        this.entityFactory.ship.updateMassAndPerformance(shipEntityId);
        return canAdd;
    }
}