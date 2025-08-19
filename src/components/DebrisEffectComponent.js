// src/components/DebrisEffectComponent.js
import * as THREE from 'three';
import { Component } from '../ecs/Component.js';

export class DebrisEffectComponent extends Component {
    constructor() {
        super();
        this.rotationSpeed = new THREE.Vector3();
    }
}