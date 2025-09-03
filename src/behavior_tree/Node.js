// src/behavior_tree/Node.js
export const NodeStatus = {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
    RUNNING: 'RUNNING',
};

export class Node {
    tick(blackboard) {
        throw new Error('Tick method must be implemented by subclass');
    }
}