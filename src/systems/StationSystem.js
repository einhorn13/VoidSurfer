import { System } from '../ecs/System.js';
import * as THREE from 'three';

export class StationSystem extends System {
    constructor(world) {
        super(world);
        // Helper objects to avoid creating them in the loop
        this.deltaRotation = new THREE.Quaternion();
        this.rotationAxis = new THREE.Vector3(0, 1, 0); // Rotate around Y axis
    }
    update(delta) {
        const entities = this.world.query(['StationComponent', 'TransformComponent']);

        for (const entityId of entities) {
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const rotationAmount = 0.05 * delta;
            this.deltaRotation.setFromAxisAngle(this.rotationAxis, rotationAmount);
            transform.rotation.multiply(this.deltaRotation);
        }
    }
}