// src/components/CollisionComponent.js
import * as THREE from 'three';
import { Component } from '../ecs/Component.js';

export class CollisionComponent extends Component {
    constructor() {
        super();
        this.boundingSphere = new THREE.Sphere();
        this.boundingBox = new THREE.Box3();
    }
}