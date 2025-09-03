import { System } from '../ecs/System.js';
import { createPirateBehavior } from '../ai_behaviors/PirateBehavior.js';
import { createTraderBehavior } from '../ai_behaviors/TraderBehavior.js';
import { serviceLocator } from '../ServiceLocator.js';

export class AIBehaviorSystem extends System {
    constructor(world) {
        super(world);
        this.behaviorBlueprints = new Map();
        this.behaviorBlueprints.set('standard', createPirateBehavior());
        this.behaviorBlueprints.set('gunship', createPirateBehavior());
        this.behaviorBlueprints.set('interceptor', createPirateBehavior());
        this.behaviorBlueprints.set('trader', createTraderBehavior());

        this.services = {
            scanner: serviceLocator.get('Scanner'),
        };
    }

    update(delta) {
        const entities = this.world.query(['AIControlledComponent', 'AIConfigComponent', 'CommandQueueComponent', 'HealthComponent']);

        for (const entityId of entities) {
            const ai = this.world.getComponent(entityId, 'AIControlledComponent');
            const health = this.world.getComponent(entityId, 'HealthComponent');
            const stateComp = this.world.getComponent(entityId, 'StateComponent');

            if (health.state !== 'ALIVE') continue;
            
            if (!ai.behaviorTree) {
                const blueprint = this.behaviorBlueprints.get(ai.behaviorName);
                if (blueprint) {
                    ai.behaviorTree = blueprint;
                    this.initializeBlackboard(ai.blackboard, entityId);
                } else {
                    console.warn(`No behavior blueprint found for: ${ai.behaviorName}`);
                    continue;
                }
            }
            
            const blackboard = ai.blackboard;

            // Handle one-time objective setting
            if (stateComp && stateComp.states.has('OBJECTIVE')) {
                blackboard.objective = stateComp.states.get('OBJECTIVE');
                stateComp.states.delete('OBJECTIVE');
            }

            // Handle objective completion (e.g., after loitering)
            if (blackboard.objective && stateComp && !stateComp.states.has('LOITERING') && blackboard.activeState !== 'LOITERING') {
                 const distance = blackboard.selfPosition.distanceTo(blackboard.objective.targetPosition);
                 if (distance < blackboard.config.navReachedThreshold) {
                     blackboard.objective = null;
                 }
            }

            this.updateBlackboard(blackboard, entityId);
            ai.behaviorTree.tick(blackboard);

            const commandQueueComp = this.world.getComponent(entityId, 'CommandQueueComponent');
            for (const command of blackboard.commandQueue) {
                commandQueueComp.queue.push(command);
            }
        }
    }
    
    initializeBlackboard(blackboard, entityId) {
        const aiConfig = this.world.getComponent(entityId, 'AIConfigComponent');
        blackboard.entityId = entityId;
        blackboard.config = aiConfig.config;
        blackboard.services = this.services;
    }

    updateBlackboard(blackboard, entityId) {
        const transform = this.world.getComponent(entityId, 'TransformComponent');
        const health = this.world.getComponent(entityId, 'HealthComponent');
        const stateComp = this.world.getComponent(entityId, 'StateComponent');
        
        blackboard.commandQueue = []; // Clear command queue for the new tick.
        blackboard.selfPosition = transform.position;
        blackboard.hullRatio = health.hull.current / health.hull.max;
        blackboard.stateComponent = stateComp;
        blackboard.activeState = null;

        if (stateComp) {
            if (stateComp.states.has('LOITERING')) blackboard.activeState = 'LOITERING';
        }
        
        const scanner = blackboard.services.scanner;
        blackboard.targetId = scanner.findBestTargetInRadius(entityId, blackboard.config.scanRange);

        if (blackboard.targetId) {
            const targetTransform = this.world.getComponent(blackboard.targetId, 'TransformComponent');
            if (targetTransform) {
                blackboard.targetPosition = targetTransform.position;
            } else {
                blackboard.targetId = null;
                blackboard.targetPosition = null;
            }
        }
    }
}