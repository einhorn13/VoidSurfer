import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

/**
 * Ticks down all cooldown timers in the game.
 * This system should run first in the update loop.
 */
export class CooldownSystem extends System {
    update(delta) {
        // Tick down state-based timers
        const entities = this.world.query(['StateComponent']);
        for (const entityId of entities) {
            const stateComp = this.world.getComponent(entityId, 'StateComponent');
            
            for (const [key, state] of stateComp.states.entries()) {
                if (state.timeLeft > 0) {
                    state.timeLeft = Math.max(0, state.timeLeft - delta);

                    if (state.timeLeft === 0) {
                        if (key === 'DRIFT_ACTIVE') {
                             serviceLocator.get('eventBus').emit('notification', { text: 'Drift Disengaged', type: 'info' });
                        }
                        // Remove any state that has expired
                        stateComp.states.delete(key);
                    }
                }
            }
        }

        // Tick down individual weapon cooldowns (WCD)
        const entitiesWithHardpoints = this.world.query(['HardpointComponent']);
        for (const entityId of entitiesWithHardpoints) {
            const hardpoints = this.world.getComponent(entityId, 'HardpointComponent');
            for (const hp of hardpoints.hardpoints) {
                if (hp.cooldownLeft > 0) {
                    hp.cooldownLeft = Math.max(0, hp.cooldownLeft - delta);
                }
            }
        }
    }
}