// src/commands/ShipCommand.js
import { Command } from './Command.js';

/**
 * Base class for commands that operate on a ship entity.
 */
export class ShipCommand extends Command {
    /**
     * @param {number} entityId The ID of the ship entity to execute the command on.
     * @param {object} world The ECS world instance.
     * @param {object} services A collection of services like dataManager, etc.
     */
    execute(entityId, world, services) {
        throw new Error('ShipCommand.execute() must be implemented by subclass');
    }
}