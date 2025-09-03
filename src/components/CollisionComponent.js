import * as THREE from 'three';
import { Component } from '../ecs/Component.js';

export class CollisionComponent extends Component {
    constructor(shape = 'sphere', options = {}) {
        super();
        this.shape = shape; // 'sphere', 'box', 'ray'
        
        // Broad-phase volume, always encompasses the entire object.
        this.boundingSphere = new THREE.Sphere();
        this.boundingBox = new THREE.Box3();

        // Optional array of more precise volumes for detailed collision checks.
        // If empty, boundingSphere is used for detailed checks as well.
        this.volumes = [];

        // Stores local-space versions of volumes for dynamic updates.
        this.localVolumes = [];

        // Options for various shapes.
        this.options = options; // { radius, size, direction }
    }
}