// src/behavior_tree/Decorator.js
import { Node } from './Node.js';

export class Decorator extends Node {
    constructor(child) {
        super();
        this.child = child;
    }
}