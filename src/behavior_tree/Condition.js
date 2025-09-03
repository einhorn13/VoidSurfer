// src/behavior_tree/Condition.js
import { Node, NodeStatus } from './Node.js';

// A decorator that returns SUCCESS if a condition is met, FAILURE otherwise.
// It does not execute a child node.
export class Condition extends Node {
    constructor(conditionFn) {
        super();
        this.conditionFn = conditionFn;
    }

    tick(blackboard) {
        return this.conditionFn(blackboard) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    }
}