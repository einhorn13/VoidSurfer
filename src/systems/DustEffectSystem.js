import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class DustEffectSystem extends System {
    constructor(world) {
        super(world);
        this.camera = serviceLocator.get('Camera');
    }

    update(delta) {
        const effectEntities = this.world.query(['DustEffectComponent']);
        if (effectEntities.length === 0) return;
        
        const effect = this.world.getComponent(effectEntities[0], 'DustEffectComponent');

        const playerIds = this.world.query(['PlayerControlledComponent']);
        const playerIsAlive = playerIds.length > 0 && this.world.getComponent(playerIds[0], 'HealthComponent')?.state === 'ALIVE';

        let shipVelocity = new THREE.Vector3();
        if (playerIsAlive) {
            const physics = this.world.getComponent(playerIds[0], 'PhysicsComponent');
            if(physics) {
                shipVelocity = physics.velocity;
            }
        }
        
        effect.points.position.copy(this.camera.position);
        effect.velocity.copy(shipVelocity).negate();

        const positions = effect.points.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += effect.velocity.x * delta;
            positions[i + 1] += effect.velocity.y * delta;
            positions[i + 2] += effect.velocity.z * delta;

            if (positions[i] > effect.halfVolume) positions[i] -= effect.volumeSize;
            if (positions[i] < -effect.halfVolume) positions[i] += effect.volumeSize;
            if (positions[i + 1] > effect.halfVolume) positions[i + 1] -= effect.volumeSize;
            if (positions[i + 1] < -effect.halfVolume) positions[i + 1] += effect.volumeSize;
            if (positions[i + 2] > effect.halfVolume) positions[i + 2] -= effect.volumeSize;
            if (positions[i + 2] < -effect.halfVolume) positions[i + 2] += effect.volumeSize;
        }

        effect.points.geometry.attributes.position.needsUpdate = true;
    }
}