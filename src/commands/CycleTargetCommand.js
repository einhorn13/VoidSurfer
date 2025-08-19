// src/commands/CycleTargetCommand.js
import { ShipCommand } from './ShipCommand.js';

export class CycleTargetCommand extends ShipCommand {
    execute(entityId, world, services) {
        services.scanner.cycleTarget();
    }
}