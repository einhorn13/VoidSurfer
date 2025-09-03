import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { eventBus } from '../EventBus.js';

export class LootSystem extends System {
    constructor(world) {
        super(world);
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.eventBus = eventBus;
    }

    update(delta) {
        const entities = this.world.query(['HealthComponent']);
        
        for (const entityId of entities) {
            const health = this.world.getComponent(entityId, 'HealthComponent');

            if (health.state === 'DESTROYED') {
                if (!this.world.getComponent(entityId, 'PlayerControlledComponent')) {
                    this.eventBus.emit('npc_destroyed', { entityId });
                }

                this.handleDrops(entityId, health.damageLog);
                
                health.state = 'DROPS_HANDLED';
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

        if (!damageLog.has(playerEntityId)) return;
        
        const playerStats = this.world.getComponent(playerEntityId, 'PlayerStatsComponent');
        if (!playerStats) return;

        let totalDamage = 0;
        damageLog.forEach(damage => totalDamage += damage);
        if (totalDamage === 0) return;

        const playerDamage = damageLog.get(playerEntityId);
        const playerShare = playerDamage / totalDamage;
        
        const totalBounty = THREE.MathUtils.randInt(staticData.data.bountyCredits[0], staticData.data.bountyCredits[1]);
        const playerReward = Math.round(totalBounty * playerShare);

        if (playerReward > 0) {
            playerStats.credits += playerReward;
            eventBus.emit('player_stats_updated');
            
            const shipName = staticData.data.name || 'Pirate';
            const notificationLabel = (playerShare >= 0.999) ? 'Bounty' : 'Bounty Share';
            const notificationText = `+${playerReward} CR (${notificationLabel}: ${shipName})`;
            
            this.eventBus.emit('notification', { text: notificationText, type: 'success' });
        }
    }

    handleSalvage(entityId, position) {
        const dropsLoot = this.world.getComponent(entityId, 'DropsLootComponent');
        const staticData = this.world.getComponent(entityId, 'StaticDataComponent');
        const dropTable = dropsLoot?.drops || staticData?.data?.drops;

        if (!dropTable) return;

        const salvageContents = { items: [], credits: 0 };

        if (dropTable.credits) {
            if (typeof dropTable.credits === 'object' && dropTable.credits.amount) {
                if (Math.random() < (dropTable.credits.chance || 1.0)) {
                    const creditRange = dropTable.credits.amount;
                    salvageContents.credits = THREE.MathUtils.randInt(creditRange[0], creditRange[1]);
                }
            } 
            else if (Array.isArray(dropTable.credits)) {
                const creditRange = dropTable.credits;
                salvageContents.credits = THREE.MathUtils.randInt(creditRange[0], creditRange[1]);
            }
        }
        
        if (dropTable.items) {
            dropTable.items.forEach(itemDrop => {
                if (Math.random() < (itemDrop.chance || 1.0)) {
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