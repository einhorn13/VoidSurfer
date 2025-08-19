// src/systems/DebugSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class DebugSystem extends System {
    constructor(world) {
        super(world);
        this.scene = serviceLocator.get('Scene');
        this.debugMeshes = new Map();
        this.isEnabled = false;

        this.debugMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
    }

    toggle(enable = !this.isEnabled) {
        this.isEnabled = enable;
        console.log(`DebugSystem collisions set to: ${this.isEnabled}`);

        // Hide all debug meshes if disabled
        for (const mesh of this.debugMeshes.values()) {
            mesh.visible = this.isEnabled;
        }

        if (!this.isEnabled) {
            this.cleanup();
        }
    }

    update(delta) {
        if (!this.isEnabled) {
            return;
        }

        const entities = this.world.query(['CollisionComponent']);
        const currentEntityIds = new Set();

        for (const entityId of entities) {
            currentEntityIds.add(entityId);
            const collision = this.world.getComponent(entityId, 'CollisionComponent');
            
            let debugMesh = this.debugMeshes.get(entityId);

            if (!debugMesh) {
                const geometry = new THREE.SphereGeometry(1, 16, 8);
                debugMesh = new THREE.Mesh(geometry, this.debugMaterial);
                this.debugMeshes.set(entityId, debugMesh);
                this.scene.add(debugMesh);
            }

            // Sync position and radius
            debugMesh.position.copy(collision.boundingSphere.center);
            const radius = collision.boundingSphere.radius;
            debugMesh.scale.set(radius, radius, radius);
            debugMesh.visible = true;
        }

        // Cleanup meshes for entities that no longer exist
        for (const entityId of this.debugMeshes.keys()) {
            if (!currentEntityIds.has(entityId)) {
                this.removeDebugMesh(entityId);
            }
        }
    }

    removeDebugMesh(entityId) {
        const mesh = this.debugMeshes.get(entityId);
        if (mesh) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            this.debugMeshes.delete(entityId);
        }
    }
    
    cleanup() {
        for (const entityId of this.debugMeshes.keys()) {
            this.removeDebugMesh(entityId);
        }
    }
}