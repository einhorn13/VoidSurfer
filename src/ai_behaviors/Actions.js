// src/ai_behaviors/Actions.js
import * as THREE from 'three';
import { Action } from '../behavior_tree/Action.js';
import { Node, NodeStatus } from '../behavior_tree/Node.js';
import { AccelerateCommand } from '../commands/AccelerateCommand.js';
import { EngageTargetCommand, FlyTowardsCommand } from '../commands/AICommand.js';

export class FindBestTarget extends Action {
    tick(blackboard) {
        const { entityId, config } = blackboard;
        const scanner = blackboard.services.scanner;
        const targetId = scanner.findBestTargetInRadius(entityId, config.scanRange);

        if (targetId !== null) {
            blackboard.targetId = targetId;
            return NodeStatus.SUCCESS;
        }
        blackboard.targetId = null;
        return NodeStatus.FAILURE;
    }
}

export class Flee extends Action {
    tick(blackboard) {
        const { selfPosition, targetPosition } = blackboard;
        if (!targetPosition) return NodeStatus.FAILURE;
        
        const directionAway = new THREE.Vector3().subVectors(selfPosition, targetPosition);
        if (directionAway.lengthSq() < 0.001) {
            directionAway.randomDirection();
        }
        const fleePosition = selfPosition.clone().add(directionAway);

        blackboard.commandQueue.push(new FlyTowardsCommand(fleePosition));
        blackboard.commandQueue.push(new AccelerateCommand(true));

        return NodeStatus.SUCCESS;
    }
}

export class AttackTarget extends Action {
    tick(blackboard) {
        if (!blackboard.targetId) return NodeStatus.FAILURE;
        
        blackboard.commandQueue.push(new EngageTargetCommand(blackboard.targetId));
        
        // Let EngageTargetCommand handle turning, and just apply forward thrust
        // to move along the chosen engagement vector.
        blackboard.commandQueue.push(new AccelerateCommand(true));

        return NodeStatus.SUCCESS;
    }
}

export class Patrol extends Action {
    tick(blackboard) {
        if (!blackboard.patrolTargetPosition || blackboard.selfPosition.distanceTo(blackboard.patrolTargetPosition) < 200) {
             let direction = new THREE.Vector3();
             do {
                direction.set(
                    Math.random() - 0.5,
                    (Math.random() - 0.5) * 0.2,
                    Math.random() - 0.5
                );
             } while (direction.lengthSq() < 0.001);

            direction.normalize();
            blackboard.patrolTargetPosition = blackboard.selfPosition.clone().add(direction.multiplyScalar(3000));
        }
        
        blackboard.commandQueue.push(new FlyTowardsCommand(blackboard.patrolTargetPosition));
        blackboard.commandQueue.push(new AccelerateCommand(true));

        return NodeStatus.SUCCESS;
    }
}

export class NavigateToObjective extends Action {
    tick(blackboard) {
        const { objective, selfPosition } = blackboard;
        if (!objective || !objective.targetPosition) {
            return NodeStatus.FAILURE; 
        }

        blackboard.commandQueue.push(new FlyTowardsCommand(objective.targetPosition));
        blackboard.commandQueue.push(new AccelerateCommand(true));

        return NodeStatus.RUNNING;
    }
}

export class IsAtObjective extends Action {
    tick(blackboard) {
        const { objective, selfPosition, config } = blackboard;
        if (!objective || !objective.targetPosition) {
            return NodeStatus.FAILURE;
        }

        const distance = selfPosition.distanceTo(objective.targetPosition);
        if (distance < config.navReachedThreshold) {
            return NodeStatus.SUCCESS;
        }
        return NodeStatus.FAILURE;
    }
}

export class Loiter extends Action {
    tick(blackboard) {
        const { objective, stateComponent } = blackboard;
        
        if (blackboard.activeState === 'LOITERING') {
            return NodeStatus.RUNNING;
        }

        // If not already loitering, start now.
        const loiterTime = objective.loiterTime || 30.0;
        stateComponent.states.set('LOITERING', { timeLeft: loiterTime, duration: loiterTime });
        blackboard.activeState = 'LOITERING';
        
        // Stop moving
        blackboard.commandQueue.push(new AccelerateCommand(false));

        return NodeStatus.RUNNING;
    }
}