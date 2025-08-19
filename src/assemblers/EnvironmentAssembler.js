// src/assemblers/EnvironmentAssembler.js
import * as THREE from 'three';
import { BaseAssembler } from './BaseAssembler.js';
import { MeshFactory } from '../MeshFactory.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { CollisionComponent } from '../components/CollisionComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { StationComponent } from '../components/StationComponent.js';
import { AsteroidTag } from '../components/AsteroidTag.js';
import { DropsLootComponent } from '../components/DropsLootComponent.js';
import { CelestialBodyTag } from '../components/CelestialBodyTag.js';
import { StaticDataComponent } from '../components/StaticDataComponent.js';

export class EnvironmentAssembler extends BaseAssembler {
    constructor() {
        super();
        this.managedMeshes = new Map(); // Stores { mesh, nextId, freeIds }
        this.matrix = new THREE.Matrix4(); // Reusable matrix
    }

    registerInstancedMeshType(typeId) {
        if (this.managedMeshes.has(typeId)) return;

        const MAX_ASTEROIDS_PER_TYPE = 200;
        const asteroidData = this.dataManager.getAsteroidData(typeId);
        const mesh = MeshFactory.createAsteroidMesh(asteroidData);
        const instancedMesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, MAX_ASTEROIDS_PER_TYPE);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // optimization hint
        
        instancedMesh.count = 0;
        
        this.scene.add(instancedMesh);

        this.managedMeshes.set(typeId, {
            mesh: instancedMesh,
            nextId: 0,
            freeIds: []
        });
    }

    createAsteroid(typeId, position) {
        const asteroidData = this.dataManager.getAsteroidData(typeId);
        const meshData = this.managedMeshes.get(typeId);
        if (!asteroidData || !meshData) return null;

        let instanceId;
        if (meshData.freeIds.length > 0) {
            instanceId = meshData.freeIds.pop();
        } else {
            // FIX: Check against the total buffer capacity (instanceMatrix.count)
            // instead of the currently rendered count (mesh.count).
            if (meshData.nextId >= meshData.mesh.instanceMatrix.count) {
                console.warn(`Max instances reached for asteroid type ${typeId}`);
                return null;
            }
            instanceId = meshData.nextId++;
            meshData.mesh.count = meshData.nextId;
        }

        const entityId = this.ecsWorld.createEntity();
        const renderComponent = new RenderComponent(meshData.mesh, true, instanceId);
        renderComponent.scale.set(
            THREE.MathUtils.randFloat(0.8, 1.5), THREE.MathUtils.randFloat(0.8, 1.5), THREE.MathUtils.randFloat(0.8, 1.5)
        );
        const rotation = new THREE.Quaternion().random();

        this.matrix.compose(position, rotation, renderComponent.scale);
        meshData.mesh.setMatrixAt(instanceId, this.matrix);
        meshData.mesh.instanceMatrix.needsUpdate = true;

        this.ecsWorld.addComponent(entityId, new TransformComponent({ position: position, rotation: rotation }));
        this.ecsWorld.addComponent(entityId, renderComponent);
        this.ecsWorld.addComponent(entityId, new CollisionComponent());
        this.ecsWorld.addComponent(entityId, new HealthComponent({
            hull: asteroidData.health, maxHull: asteroidData.health, shield: 0, maxShield: 0, shieldRegenRate: 0
        }));
        this.ecsWorld.addComponent(entityId, new PhysicsComponent({
            mass: asteroidData.health * 2,
            velocity: new THREE.Vector3(THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2)),
            bodyType: 'dynamic'
        }));
        if (asteroidData.resources && asteroidData.resources.itemId) {
            this.ecsWorld.addComponent(entityId, new DropsLootComponent({
                items: [{ itemId: asteroidData.resources.itemId, quantity: asteroidData.resources.amount, chance: 1.0 }]
            }));
        }
        this.ecsWorld.addComponent(entityId, new AsteroidTag());
        this.ecsWorld.addComponent(entityId, new StaticDataComponent({ type: 'asteroid', id: typeId }));

        return entityId;
    }

    releaseInstanceId(typeId, instanceId) {
        const meshData = this.managedMeshes.get(typeId);
        if (meshData && !meshData.freeIds.includes(instanceId)) {
            this.matrix.makeScale(0, 0, 0);
            meshData.mesh.setMatrixAt(instanceId, this.matrix);
            meshData.mesh.instanceMatrix.needsUpdate = true;
            meshData.freeIds.push(instanceId);
        }
    }
    
    createStation(position) {
        const entityId = this.ecsWorld.createEntity();
        const balanceConfig = this.dataManager.getConfig('game_balance').gameplay.station;
        const mesh = MeshFactory.createStationMesh();
        
        this.ecsWorld.addComponent(entityId, new TransformComponent({ position }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, new CollisionComponent());
        this.ecsWorld.addComponent(entityId, new StationComponent(balanceConfig));
        this.ecsWorld.addComponent(entityId, new PhysicsComponent({ mass: 1e9, bodyType: 'static' }));
        this.ecsWorld.addComponent(entityId, new StaticDataComponent({ type: 'station' }));

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }

    createPlanet(planetData) {
        const entityId = this.ecsWorld.createEntity();
        const mesh = MeshFactory.createPlanetMesh(planetData);
        mesh.position.set(...planetData.position);

        const collision = new CollisionComponent();
        collision.boundingSphere.radius = planetData.size;

        this.ecsWorld.addComponent(entityId, new TransformComponent({ position: mesh.position }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, collision);
        this.ecsWorld.addComponent(entityId, new CelestialBodyTag());
        this.ecsWorld.addComponent(entityId, new PhysicsComponent({ mass: 1e12, bodyType: 'static' }));
        this.ecsWorld.addComponent(entityId, new StaticDataComponent({ type: 'planet' }));

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }

    createSun(sunData) {
        const entityId = this.ecsWorld.createEntity();
        const mesh = MeshFactory.createSunMesh(sunData);
        mesh.position.set(...sunData.position);

        const collision = new CollisionComponent();
        collision.boundingSphere.radius = sunData.size;

        this.ecsWorld.addComponent(entityId, new TransformComponent({ position: mesh.position }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, collision);
        this.ecsWorld.addComponent(entityId, new CelestialBodyTag());
        this.ecsWorld.addComponent(entityId, new PhysicsComponent({ mass: 1e15, bodyType: 'static' }));
        this.ecsWorld.addComponent(entityId, new StaticDataComponent({ type: 'sun' }));

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }
}