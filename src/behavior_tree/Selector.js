// src/behavior_tree/Selector.js
import { Composite } from './Composite.js';
import { NodeStatus } from './Node.js';

// Ticks children sequentially until one succeeds.
export class Selector extends Composite {
    tick(blackboard) {
        for (const child of this.children) {
            const status = child.tick(blackboard);
            if (status !== NodeStatus.FAILURE) {
                return status;
            }
        }
        return NodeStatus.FAILURE;
    }
}