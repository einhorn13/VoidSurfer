// src/components/TransformComponent.js
import * as THREE from 'three';
import { Component } from '../ecs/Component.js';

export class TransformComponent extends Component {
    constructor({ position, rotation }) {
        super();
        this.position = position || new THREE.Vector3();
        this.rotation = rotation || new THREE.Quaternion();
        this.prevPosition = this.position.clone();
    }
}