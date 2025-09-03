// src/behavior_tree/Composite.js
import { Node } from './Node.js';

export class Composite extends Node {
    constructor(children = []) {
        super();
        this.children = children;
    }

    addChild(child) {
        this.children.push(child);
    }
}