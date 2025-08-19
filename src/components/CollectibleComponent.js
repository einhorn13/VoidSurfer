// src/components/CollectibleComponent.js
import { Component } from '../ecs/Component.js';

export class CollectibleComponent extends Component {
    constructor(contents) {
        super();
        // contents is an object like:
        // { items: [{ itemId, quantity }], credits: 100 }
        this.contents = contents;
    }
}