import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { eventBus } from '../EventBus.js';

export class ItemCollectionSystem extends System {
    constructor(world) {
        super(world);
        this.dataManager = serviceLocator.get('DataManager');
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.navigationService = serviceLocator.get('NavigationService');
        this.cargoFullNotificationCooldown = 0;
    }

    update(delta) {
        this.cargoFullNotificationCooldown = Math.max(0, this.cargoFullNotificationCooldown - delta);
        const collectionEvents = this.world.getEvents('collection_collision');

        for (const event of collectionEvents) {
            const { collectorId, collectibleId } = event;

            const isPlayerCollector = !!this.world.getComponent(collectorId, 'PlayerControlledComponent');

            const collectibleComp = this.world.getComponent(collectibleId, 'CollectibleComponent');
            const collectibleHealth = this.world.getComponent(collectibleId, 'HealthComponent');
            if (!collectibleComp || !collectibleHealth || collectibleHealth.state !== 'ALIVE') continue;
            
            const contents = collectibleComp.contents;
            let anythingCollected = false;

            if (contents.credits > 0) {
                const stats = this.world.getComponent(collectorId, 'PlayerStatsComponent');
                if (stats) {
                    stats.credits += contents.credits;
                    eventBus.emit('player_stats_updated');
                }
                if (isPlayerCollector) {
                    eventBus.emit('notification', { text: `+${contents.credits} CR (Salvaged)`, type: 'success' });
                }
                anythingCollected = true;
            }

            if (contents.items && contents.items.length > 0) {
                contents.items.forEach(item => {
                    const pickedUp = this._addCargo(collectorId, item.itemId, item.quantity);
                    if (pickedUp > 0) {
                        if (isPlayerCollector) {
                            const itemData = this.dataManager.getItemData(item.itemId);
                            const itemName = itemData ? itemData.name : 'Unknown Item';
                            eventBus.emit('notification', { text: `+${pickedUp} ${itemName}`, type: 'success' });
                        }
                        anythingCollected = true;
                    } else if (isPlayerCollector && pickedUp === 0 && item.quantity > 0 && this.cargoFullNotificationCooldown === 0) {
                        eventBus.emit('notification', { text: 'Cargo hold full', type: 'info' });
                        this.cargoFullNotificationCooldown = 3.0; // 3 second cooldown
                    }
                });
            }
            
            if (anythingCollected) {
                collectibleHealth.state = 'DESTROYED';
                const render = this.world.getComponent(collectibleId, 'RenderComponent');
                if (render) {
                    render.isVisible = false;
                }

                const currentTarget = this.navigationService.getTarget();
                if (currentTarget && currentTarget.type === 'entity' && currentTarget.entityId === collectibleId) {
                    this.navigationService.clearTarget();
                }
            }
        }
    }

    _addCargo(shipEntityId, itemId, quantity) {
        const cargo = this.world.getComponent(shipEntityId, 'CargoComponent');
        if (!cargo) return 0;

        const remainingCapacity = cargo.capacity - cargo.currentMass;
        if (remainingCapacity <= 0) return 0;

        const itemDataToAdd = this.dataManager.getItemData(itemId);
        const massPerUnit = itemDataToAdd?.mass || 1;
        
        const canAddByMass = Math.floor(remainingCapacity / massPerUnit);
        const canAdd = Math.min(quantity, canAddByMass);
        if (canAdd <= 0) return 0;

        const currentQuantity = cargo.items.get(itemId) || 0;
        cargo.items.set(itemId, currentQuantity + canAdd);
        
        cargo.currentMass += canAdd * massPerUnit;
        
        this.entityFactory.ship.updateMassAndPerformance(shipEntityId);
        return canAdd;
    }
}