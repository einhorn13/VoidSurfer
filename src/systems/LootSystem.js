// src/systems/LootSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class LootSystem extends System {
    constructor(world) {
        super(world);
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.gameStateManager = serviceLocator.get('GameStateManager');
    }

    update(delta) {
        const entities = this.world.query(['HealthComponent']);
        
        for (const entityId of entities) {
            const health = this.world.getComponent(entityId, 'HealthComponent');

            if (health.isDestroyed && !health.dropsHandled) {
                this.handleDrops(entityId, health.damageLog);
                health.dropsHandled = true;
            }
        }
    }

    handleDrops(entityId, damageLog) {
        const transform = this.world.getComponent(entityId, 'TransformComponent');
        if (!transform) return;
        
        this.handleBounty(entityId, damageLog);
        this.handleSalvage(entityId, transform.position);
    }

    handleBounty(entityId, damageLog) {
        const staticData = this.world.getComponent(entityId, 'StaticDataComponent');
        if (!staticData || !staticData.data || staticData.data.faction !== 'PIRATE_FACTION' || !staticData.data.bountyCredits) {
            return;
        }

        const playerIds = this.world.query(['PlayerControlledComponent']);
        if (playerIds.length === 0) return;
        const playerEntityId = playerIds[0];

        if (!damageLog.has(playerEntityId)) {
            return; // Player did not participate
        }
        
        let totalDamage = 0;
        damageLog.forEach(damage => totalDamage += damage);
        if (totalDamage === 0) return;

        const playerDamage = damageLog.get(playerEntityId);
        const playerShare = playerDamage / totalDamage;
        
        const totalBounty = THREE.MathUtils.randInt(staticData.data.bountyCredits[0], staticData.data.bountyCredits[1]);
        const playerReward = Math.round(totalBounty * playerShare);

        if (playerReward > 0) {
            this.gameStateManager.addCredits(playerReward);

            // FIX: Use conditional text for the notification
            const notificationLabel = (playerShare >= 0.999) ? '(Bounty)' : '(Bounty Share)';
            const notificationText = `+${playerReward} CR ${notificationLabel}`;
            
            serviceLocator.get('eventBus').emit('notification', { text: notificationText, type: 'success' });
        }
    }

    handleSalvage(entityId, position) {
        const dropsLoot = this.world.getComponent(entityId, 'DropsLootComponent');
        const staticData = this.world.getComponent(entityId, 'StaticDataComponent');
        const dropTable = dropsLoot?.drops || staticData?.data?.drops;

        if (!dropTable) return;

        const salvageContents = { items: [], credits: 0 };

        if (dropTable.credits && Math.random() < (dropTable.credits.chance || 1.0)) {
            const creditAmount = THREE.MathUtils.randInt(dropTable.credits.amount[0], dropTable.credits.amount[1]);
            if (creditAmount > 0) {
                salvageContents.credits = creditAmount;
            }
        }

        if (dropTable.items) {
            dropTable.items.forEach(itemDrop => {
                if (Math.random() < itemDrop.chance) {
                    const quantity = Array.isArray(itemDrop.quantity)
                        ? THREE.MathUtils.randInt(itemDrop.quantity[0], itemDrop.quantity[1])
                        : itemDrop.quantity;
                    
                    if (quantity > 0) {
                        salvageContents.items.push({ itemId: itemDrop.itemId, quantity });
                    }
                }
            });
        }
        
        if (salvageContents.items.length > 0 || salvageContents.credits > 0) {
            this.entityFactory.createSalvageContainer(salvageContents, position);
        }
    }
}