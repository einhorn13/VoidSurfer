// src/behavior_tree/Sequence.js
import { Composite } from './Composite.js';
import { NodeStatus } from './Node.js';

// Ticks children sequentially until one fails.
export class Sequence extends Composite {
    tick(blackboard) {
        for (const child of this.children) {
            const status = child.tick(blackboard);
            if (status !== NodeStatus.SUCCESS) {
                return status;
            }
        }
        return NodeStatus.SUCCESS;
    }
}