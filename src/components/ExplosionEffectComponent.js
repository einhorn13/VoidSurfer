// src/components/ExplosionEffectComponent.js
import * as THREE from 'three';
import { Component } from '../ecs/Component.js';

export class ExplosionEffectComponent extends Component {
    constructor(particleCount = 50) {
        super();
        this.velocities = [];
        for (let i = 0; i < particleCount; i++) {
            this.velocities.push(new THREE.Vector3());
        }
    }
}