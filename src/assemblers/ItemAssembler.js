// src/assemblers/ItemAssembler.js
import * as THREE from 'three';
import { BaseAssembler } from './BaseAssembler.js';
import { MeshFactory } from '../MeshFactory.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { CollisionComponent } from '../components/CollisionComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { CollectibleComponent } from '../components/CollectibleComponent.js';
import { StaticDataComponent } from '../components/StaticDataComponent.js';
import { LifetimeComponent } from '../components/LifetimeComponent.js';

export class ItemAssembler extends BaseAssembler {
    // This method is now used for simple, single-item drops (e.g., from asteroids)
    createItem(itemId, quantity, position) {
        const itemData = this.dataManager.getItemData(itemId);
        if (!itemData) {
            console.error(`ItemAssembler: Item data not found for ID ${itemId}`);
            return null;
        }

        const entityId = this.ecsWorld.createEntity();
        const mesh = MeshFactory.createItemMesh(); // Simple icosahedron for raw materials

        const contents = {
            items: [{ itemId, quantity }],
            credits: 0
        };

        const collision = new CollisionComponent();
        // FIX: Manually set the collision sphere radius based on the mesh size.
        collision.boundingSphere.radius = 0.8;

        this.ecsWorld.addComponent(entityId, new TransformComponent({ position }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, collision);
        this.ecsWorld.addComponent(entityId, new CollectibleComponent(contents));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }));
        this.ecsWorld.addComponent(entityId, new StaticDataComponent({ type: 'item', id: itemId }));
        
        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }

    // New method for creating salvage containers from destroyed ships
    createSalvageContainer(contents, position) {
        const entityId = this.ecsWorld.createEntity();
        const mesh = MeshFactory.createSalvageMesh(); // Wreckage-like box

        const lifetime = THREE.MathUtils.randFloat(300, 600); // 5 to 10 minutes

        const collision = new CollisionComponent();
        // FIX: Manually set the collision sphere radius to an appropriate size for the container.
        collision.boundingSphere.radius = 1.0;

        this.ecsWorld.addComponent(entityId, new TransformComponent({ position }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, collision);
        this.ecsWorld.addComponent(entityId, new CollectibleComponent(contents));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }));
        this.ecsWorld.addComponent(entityId, new StaticDataComponent({ type: 'salvage' }));
        this.ecsWorld.addComponent(entityId, new LifetimeComponent(lifetime));

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }
}