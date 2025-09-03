// src/commands/ShipCommand.js
import { Command } from './Command.js';

/**
 * Base class for commands that operate on a ship entity.
 */
export class ShipCommand extends Command {
    execute(entityId, world, services) {
        throw new Error('ShipCommand.execute() must be implemented by subclass');
    }
}