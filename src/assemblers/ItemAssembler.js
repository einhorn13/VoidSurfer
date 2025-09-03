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
import { MapIconComponent } from '../components/MapIconComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';

export class ItemAssembler extends BaseAssembler {
    // This method is now used for simple, single-item drops (e.g., from asteroids)
    createItem(itemId, quantity, position) {
        const itemData = this.dataManager.getItemData(itemId);
        if (!itemData) {
            console.error(`ItemAssembler: Item data not found for ID ${itemId}`);
            return null;
        }

        const mesh = MeshFactory.createItemMesh(); // Simple icosahedron for raw materials

        const contents = {
            items: [{ itemId, quantity }],
            credits: 0
        };

        const collision = new CollisionComponent();
        collision.boundingSphere.radius = 0.8;

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position }))
            .with(new RenderComponent(mesh))
            .with(collision)
            .with(new CollectibleComponent(contents))
            .with(new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }))
            .with(new StaticDataComponent({ type: 'item', id: itemId }))
            .build();
        
        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }

    // New method for creating salvage containers from destroyed ships
    createSalvageContainer(contents, position) {
        const mesh = MeshFactory.createSalvageMesh(); // Wreckage-like box
        const lifetime = THREE.MathUtils.randFloat(300, 600); // 5 to 10 minutes
        const collision = new CollisionComponent();
        collision.boundingSphere.radius = 1.0;

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position }))
            .with(new RenderComponent(mesh))
            .with(collision)
            .with(new CollectibleComponent(contents))
            .with(new HealthComponent({ hull: 1, maxHull: 1, shield: 0, maxShield: 0, shieldRegenRate: 0 }))
            .with(new StaticDataComponent({ type: 'salvage' }))
            .with(new LifetimeComponent(lifetime))
            .with(new MapIconComponent({ iconType: 'square', color: '#00aaff', isStatic: false }))
            .with(new PhysicsComponent({ mass: 1, bodyType: 'static' }))
            .build();

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }
}