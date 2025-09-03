import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';

export class CameraController {
    constructor(camera, initialTargetId) {
        this.camera = camera;
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.targetId = initialTargetId;
        this.targetFov = 75;
    }

    setTarget(targetId) {
        this.targetId = targetId;
    }

    update(delta) {
        if (this.targetId === null) return;
        
        const health = this.ecsWorld.getComponent(this.targetId, 'HealthComponent');
        if (!health || health.state !== 'ALIVE') return;

        const physics = this.ecsWorld.getComponent(this.targetId, 'PhysicsComponent');
        const transform = this.ecsWorld.getComponent(this.targetId, 'TransformComponent');
        if (!physics || !transform) return;

        const boostMultiplier = physics.boostMultiplier || 1.0;
        this.targetFov = boostMultiplier > 1.0 ? 90 : 75;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, delta * 5);
        this.camera.updateProjectionMatrix();

        const idealOffset = new THREE.Vector3(0, 3, 7);
        idealOffset.applyQuaternion(transform.rotation);
        
        const cameraPosition = transform.position.clone().add(idealOffset);
        
        this.camera.position.lerp(cameraPosition, 0.2);
        this.camera.quaternion.slerp(transform.rotation, 0.1);
    }
}