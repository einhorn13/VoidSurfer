import * as THREE from 'three';
import { System } from '../ecs/System.js';

export class InstancedRenderSystem extends System {
    constructor(world) {
        super(world);
        this.meshesToUpdate = new Set();
    }

    update(delta) {
        this.meshesToUpdate.clear();
        const entities = this.world.query(['TransformComponent', 'RenderComponent', 'StaticDataComponent']);
        const matrix = new THREE.Matrix4();

        for (const entityId of entities) {
            const render = this.world.getComponent(entityId, 'RenderComponent');
            if (!render.isInstanced) continue;

            const staticData = this.world.getComponent(entityId, 'StaticDataComponent');
            if (staticData.data.type !== 'asteroid') continue;
                
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            matrix.compose(transform.position, transform.rotation, render.scale);
            
            render.mesh.setMatrixAt(render.instanceId, matrix);
            this.meshesToUpdate.add(render.mesh);
        }

        for (const mesh of this.meshesToUpdate) {
            mesh.instanceMatrix.needsUpdate = true;
        }
    }
}