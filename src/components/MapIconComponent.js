// src/components/MapIconComponent.js
import { Component } from '../ecs/Component.js';

/**
 * Contains data for how an entity should be represented on a 2D map.
 */
export class MapIconComponent extends Component {
    constructor({ iconType, color, isStatic = false }) {
        super();
        this.iconType = iconType; // e.g., 'triangle', 'square', 'circle', 'station'
        this.color = color;       // Hex color string (e.g., '#ff0000')
        this.isStatic = isStatic; // Is the object stationary (e.g., planet, station)?
    }
}