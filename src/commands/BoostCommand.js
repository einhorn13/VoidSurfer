// src/commands/BoostCommand.js
import { ShipCommand } from './ShipCommand.js';

export class BoostCommand extends ShipCommand {
    constructor(isActive) {
        super();
        this.isActive = isActive;
    }

    execute(entityId, world, services) {
        const { inputSystem, delta } = services;
        const energy = world.getComponent(entityId, 'EnergyComponent');
        const physics = world.getComponent(entityId, 'PhysicsComponent');
        if (!energy || !physics) return;

        const boostConfig = inputSystem.boostConfig;

        if (this.isActive) {
            if (!inputSystem.isBoosting && energy.current > boostConfig.activationCost) {
                inputSystem.isBoosting = true;
                energy.current -= boostConfig.activationCost;
            }
            if (inputSystem.isBoosting && energy.current > 0) {
                physics.boostMultiplier = boostConfig.speedMultiplier;
                energy.current -= boostConfig.energyCostPerSecond * delta;
                physics.isAccelerating = true;
            } else {
                // Not enough energy to continue boosting
                inputSystem.isBoosting = false;
                physics.boostMultiplier = 1.0;
            }
        } else {
            inputSystem.isBoosting = false;
            physics.boostMultiplier = 1.0;
        }
    }
}