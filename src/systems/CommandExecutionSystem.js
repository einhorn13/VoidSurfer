import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

/**
 * Executes all commands queued in CommandQueueComponent for each entity.
 */
export class CommandExecutionSystem extends System {
    constructor(world) {
        super(world);
        this.scanner = serviceLocator.get('Scanner');
    }

    update(delta) {
        const entities = this.world.query(['CommandQueueComponent']);

        const commandServices = {
            delta,
            scanner: this.scanner,
        };
        
        for (const entityId of entities) {
            const commandQueueComp = this.world.getComponent(entityId, 'CommandQueueComponent');
            const queue = commandQueueComp.queue;

            if (queue.length > 0) {
                const health = this.world.getComponent(entityId, 'HealthComponent');
                if (health && health.state !== 'ALIVE') {
                    queue.length = 0;
                    continue;
                }

                for (const command of queue) {
                    command.execute(entityId, this.world, commandServices);
                }
                
                queue.length = 0;
            }
        }
    }
}