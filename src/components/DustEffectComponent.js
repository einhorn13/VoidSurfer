// src/components/DustEffectComponent.js
import * as THREE from 'three';
import { Component } from '../ecs/Component.js';
import { serviceLocator } from '../ServiceLocator.js';

const DUST_PARTICLE_COUNT = 500;
const DUST_VOLUME_SIZE = 200;
const DUST_PARTICLE_SIZE = 1.5;

export class DustEffectComponent extends Component {
    constructor() {
        super();
        const scene = serviceLocator.get('Scene');

        this.volumeSize = DUST_VOLUME_SIZE;
        this.halfVolume = this.volumeSize / 2;
        this.velocity = new THREE.Vector3();

        const vertices = [];
        for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
            vertices.push(
                THREE.MathUtils.randFloatSpread(this.volumeSize),
                THREE.MathUtils.randFloatSpread(this.volumeSize),
                THREE.MathUtils.randFloatSpread(this.volumeSize)
            );
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: DUST_PARTICLE_SIZE,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: false
        });

        this.points = new THREE.Points(geometry, material);
        scene.add(this.points);
    }
}