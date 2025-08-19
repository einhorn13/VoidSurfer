// src/commands/DeselectTargetCommand.js
import { ShipCommand } from './ShipCommand.js';

export class DeselectTargetCommand extends ShipCommand {
    execute(entityId, world, services) {
        services.scanner.deselectTarget();
    }
}