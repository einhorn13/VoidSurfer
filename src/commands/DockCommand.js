// src/commands/DockCommand.js
import { ShipCommand } from './ShipCommand.js';

export class DockCommand extends ShipCommand {
    execute(entityId, world, services) {
        // The command itself doesn't need to do much.
        // The InputSystem will perform the necessary checks
        // and then publish an event.
        // This command acts as a signal for that intent.
    }
}