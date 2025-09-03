// src/systems/RegenerationSystem.js
import { System } from '../ecs/System.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { EnergyComponent } from '../components/EnergyComponent.js';

export class RegenerationSystem extends System {
    update(delta) {
        const healthEntities = this.world.query(['HealthComponent']);
        const energyEntities = this.world.query(['EnergyComponent']);

        // Use a Set to process each entity only once, even if it has both components
        const allEntities = new Set([...healthEntities, ...energyEntities]);
        
        for (const entityId of allEntities) {
            const health = this.world.getComponent(entityId, 'HealthComponent');
            const energy = this.world.getComponent(entityId, 'EnergyComponent');
            const healthBar = this.world.getComponent(entityId, 'HealthBarComponent');

            // Regenerate shields
            if (health && health.shield.current < health.shield.max) {
                const oldShield = health.shield.current;
                health.shield.current = Math.min(
                    health.shield.max,
                    health.shield.current + health.shield.regenRate * delta
                );
                // OPTIMIZATION: Set flag if shield changed
                if (healthBar && oldShield !== health.shield.current) {
                    healthBar.needsUpdate = true;
                }
            }

            // Regenerate energy
            if (energy && energy.current < energy.max) {
                energy.current = Math.min(
                    energy.max,
                    energy.current + energy.regenRate * delta
                );
            }
        }
    }
}