import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class DebugSystem extends System {
    constructor(world) {
        super(world);
        this.scene = serviceLocator.get('Scene');
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.debugGroups = new Map(); // Use a group for each entity to hold multiple debug meshes
        this.isEnabled = false;
        
        this.ecsDebugger = null;

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

        if (this.ecsDebugger) {
            this.ecsDebugger.toggle(this.isEnabled);
        }
        
        if (!this.isEnabled) {
            this.gameStateManager.resetSimulationSpeed();
            this.cleanup();
        }

        // Hide all debug groups if disabled
        for (const group of this.debugGroups.values()) {
            group.visible = this.isEnabled;
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
            
            let debugGroup = this.debugGroups.get(entityId);

            if (!debugGroup) {
                debugGroup = new THREE.Group();
                this.debugGroups.set(entityId, debugGroup);
                this.scene.add(debugGroup);
            }
            debugGroup.visible = true;

            // Determine which volumes to render
            const volumesToRender = collision.volumes.length > 0 ? collision.volumes : [collision.boundingSphere];
            
            // Sync number of debug meshes with number of volumes
            while (debugGroup.children.length < volumesToRender.length) {
                const geometry = new THREE.SphereGeometry(1, 16, 8);
                const mesh = new THREE.Mesh(geometry, this.debugMaterial);
                debugGroup.add(mesh);
            }
            while (debugGroup.children.length > volumesToRender.length) {
                const mesh = debugGroup.children.pop();
                mesh.geometry.dispose();
            }

            // Update positions and scales of each debug mesh
            for (let i = 0; i < volumesToRender.length; i++) {
                const volume = volumesToRender[i];
                const debugMesh = debugGroup.children[i];

                if (volume instanceof THREE.Sphere) {
                    debugMesh.position.copy(volume.center);
                    const radius = volume.radius;
                    debugMesh.scale.set(radius, radius, radius);
                }
            }
        }

        // Cleanup groups for entities that no longer exist
        for (const entityId of this.debugGroups.keys()) {
            if (!currentEntityIds.has(entityId)) {
                this.removeDebugGroup(entityId);
            }
        }
    }

    removeDebugGroup(entityId) {
        const group = this.debugGroups.get(entityId);
        if (group) {
            // Dispose geometries of all children
            group.children.forEach(mesh => {
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
            });
            this.scene.remove(group);
            this.debugGroups.delete(entityId);
        }
    }
    
    cleanup() {
        for (const entityId of this.debugGroups.keys()) {
            this.removeDebugGroup(entityId);
        }
    }
}