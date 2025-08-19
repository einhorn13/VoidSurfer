// src/components/StaticDataComponent.js
import { Component } from '../ecs/Component.js';

/**
 * Stores a reference to the static configuration data for an entity.
 * This is used to access properties like drop tables, procedural model info, etc.,
 * without needing a "fat" entity object.
 */
export class StaticDataComponent extends Component {
    constructor(data) {
        super();
        this.data = data;
    }
}