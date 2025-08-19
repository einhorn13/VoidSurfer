// src/systems/RenderSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';

export class RenderSystem extends System {
    update(delta) {
        const entities = this.world.query(['TransformComponent', 'RenderComponent']);

        for (const entityId of entities) {
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const render = this.world.getComponent(entityId, 'RenderComponent');

            if (render.isInstanced) continue;

            if (render.mesh) {
                render.mesh.position.copy(transform.position);

                if (!(render.mesh instanceof THREE.Sprite)) {
                    render.mesh.quaternion.copy(transform.rotation);
                    render.mesh.scale.copy(render.scale);
                }

                render.mesh.visible = render.isVisible;
            }
        }
    }
}