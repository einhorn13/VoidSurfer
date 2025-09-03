// src/commands/BoostCommand.js
import { ShipCommand } from './ShipCommand.js';
import { serviceLocator } from '../ServiceLocator.js';

export class BoostCommand extends ShipCommand {
    constructor(isActive) {
        super();
        this.isActive = isActive;
        this.boostConfig = serviceLocator.get('DataManager').getConfig('game_balance').playerBoost;
    }

    execute(entityId, world, services) {
        const energy = world.getComponent(entityId, 'EnergyComponent');
        const physics = world.getComponent(entityId, 'PhysicsComponent');
        const stateComp = world.getComponent(entityId, 'StateComponent');
        if (!energy || !physics || !stateComp) return;

        if (this.isActive) {
            if (stateComp.states.has('BOOSTING') || stateComp.states.has('GLOBAL_COOLDOWN')) {
                return;
            }

            if (energy.current > this.boostConfig.activationCost) {
                stateComp.states.set('BOOSTING', { active: true });
                energy.current -= this.boostConfig.activationCost;
                
                physics.boostMultiplier = this.boostConfig.speedMultiplier;
                physics.isAccelerating = true; 

                const gcdDuration = 1.0;
                stateComp.states.set('GLOBAL_COOLDOWN', { timeLeft: gcdDuration, duration: gcdDuration });
            }
        } else {
            stateComp.states.delete('BOOSTING');
            physics.boostMultiplier = 1.0;
        }
    }
}