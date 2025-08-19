// src/components/RenderComponent.js
import * as THREE from 'three';
import { Component } from '../ecs/Component.js';

export class RenderComponent extends Component {
    constructor(mesh, isInstanced = false, instanceId = -1) {
        super();
        this.mesh = mesh;
        this.isVisible = true;
        this.isInstanced = isInstanced;
        this.instanceId = instanceId;
        this.scale = new THREE.Vector3(1, 1, 1);
    }
}