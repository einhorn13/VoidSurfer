// src/components/FactionComponent.js
import { Component } from '../ecs/Component.js';

export class FactionComponent extends Component {
    constructor(factionName) {
        super();
        this.name = factionName;
    }
}