// src/components/DamageNumberComponent.js
import * as THREE from 'three';
import { Component } from '../ecs/Component.js';

/**
 * A component for floating damage numbers.
 * Contains the velocity at which the number rises.
 */
export class DamageNumberComponent extends Component {
    constructor() {
        super();
        this.velocity = new THREE.Vector3(0, 5, 0); // Move upwards
    }
}