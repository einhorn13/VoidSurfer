// src/components/PhysicsComponent.js
import * as THREE from 'three';
import { Component } from '../ecs/Component.js';

export class PhysicsComponent extends Component {
    constructor({ velocity, mass, turnSpeed, acceleration, maxSpeed, bodyType = 'dynamic' }) {
        super();
        this.velocity = velocity || new THREE.Vector3();
        this.mass = mass || 1;
        this.turnSpeed = turnSpeed || 0;
        this.acceleration = acceleration || 0;
        this.maxSpeed = maxSpeed || 0;
        this.bodyType = bodyType; // 'dynamic' or 'static'
        
        this.isAccelerating = false;
        this.boostMultiplier = 1.0;
    }
}