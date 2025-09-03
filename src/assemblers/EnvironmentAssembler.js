import * as THREE from 'three';
import { BaseAssembler } from './BaseAssembler.js';
import { MeshFactory } from '../MeshFactory.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { CollisionComponent } from '../components/CollisionComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { StationComponent } from '../components/StationComponent.js';
import { DockableComponent } from '../components/DockableComponent.js';
import { DropsLootComponent } from '../components/DropsLootComponent.js';
import { StaticDataComponent } from '../components/StaticDataComponent.js';
import { MapIconComponent } from '../components/MapIconComponent.js';
import { FactionComponent } from '../components/FactionComponent.js';

const MAX_ASTEROIDS_PER_TYPE = 200;

export class EnvironmentAssembler extends BaseAssembler {
    constructor() {
        super();
        this.managedMeshes = new Map(); 
        this.matrix = new THREE.Matrix4();
    }

    registerInstancedMeshType(typeId) {
        if (this.managedMeshes.has(typeId)) return;

        const asteroidData = this.dataManager.getAsteroidData(typeId);
        const mesh = MeshFactory.createAsteroidMesh(asteroidData);
        const instancedMesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, MAX_ASTEROIDS_PER_TYPE);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instancedMesh.count = 0;
        
        this.scene.add(instancedMesh);

        this.managedMeshes.set(typeId, {
            mesh: instancedMesh,
            entityIdMap: new Array(MAX_ASTEROIDS_PER_TYPE).fill(null)
        });
    }

    createAsteroid(typeId, position) {
        const asteroidData = this.dataManager.getAsteroidData(typeId);
        const meshData = this.managedMeshes.get(typeId);
        if (!asteroidData || !meshData) return null;

        if (meshData.mesh.count >= MAX_ASTEROIDS_PER_TYPE) {
            console.warn(`Max instances reached for asteroid type ${typeId}`);
            return null;
        }
        const instanceId = meshData.mesh.count;

        const renderComponent = new RenderComponent(meshData.mesh, true, instanceId);
        renderComponent.scale.set(
            THREE.MathUtils.randFloat(0.8, 1.5), THREE.MathUtils.randFloat(0.8, 1.5), THREE.MathUtils.randFloat(0.8, 1.5)
        );
        const rotation = new THREE.Quaternion().random();

        this.matrix.compose(position, rotation, renderComponent.scale);
        meshData.mesh.setMatrixAt(instanceId, this.matrix);
        meshData.mesh.instanceMatrix.needsUpdate = true;
        
        meshData.mesh.count++;
        
        const builder = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position: position, rotation: rotation }))
            .with(renderComponent)
            .with(new CollisionComponent())
            .with(new HealthComponent({
                hull: asteroidData.health, maxHull: asteroidData.health, shield: 0, maxShield: 0, shieldRegenRate: 0
            }))
            .with(new PhysicsComponent({
                mass: asteroidData.health * 2,
                velocity: new THREE.Vector3(THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2), THREE.MathUtils.randFloatSpread(2)),
                bodyType: 'dynamic'
            }))
            .with(new MapIconComponent({ iconType: 'square', color: `#${asteroidData.color}`, isStatic: false }))
            .with(new StaticDataComponent({ type: 'asteroid', id: typeId, name: `${typeId.charAt(0) + typeId.slice(1).toLowerCase()} Asteroid` }));

        if (asteroidData.resources && asteroidData.resources.itemId) {
            builder.with(new DropsLootComponent({
                items: [{ itemId: asteroidData.resources.itemId, quantity: asteroidData.resources.amount, chance: 1.0 }]
            }));
        }
        
        const entityId = builder.build();
        meshData.entityIdMap[instanceId] = entityId;

        return entityId;
    }

    releaseInstanceId(typeId, instanceIdToRemove) {
        const meshData = this.managedMeshes.get(typeId);
        if (!meshData) return;

        const mesh = meshData.mesh;
        const entityIdMap = meshData.entityIdMap;

        if (instanceIdToRemove >= mesh.count) {
            return;
        }

        const lastInstanceId = mesh.count - 1;
        const lastEntityId = entityIdMap[lastInstanceId];

        if (instanceIdToRemove !== lastInstanceId) {
            mesh.getMatrixAt(lastInstanceId, this.matrix);
            mesh.setMatrixAt(instanceIdToRemove, this.matrix);

            const renderOfMovedEntity = this.ecsWorld.getComponent(lastEntityId, 'RenderComponent');
            if (renderOfMovedEntity) {
                renderOfMovedEntity.instanceId = instanceIdToRemove;
            }
            
            entityIdMap[instanceIdToRemove] = lastEntityId;
        }
        
        entityIdMap[lastInstanceId] = null;
        mesh.count--;
        mesh.instanceMatrix.needsUpdate = true;
    }
    
    createStation(position) {
        const balanceConfig = this.dataManager.getConfig('game_balance').gameplay.station;
        const mesh = MeshFactory.createStationMesh();

        const collision = this._createStationCollision();
        
        const initialRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position, rotation: initialRotation }))
            .with(new StationComponent())
            .with(new RenderComponent(mesh))
            .with(collision)
            .with(new DockableComponent({
                dockingRadius: balanceConfig.dockingRadius,
                maxDockingSpeed: balanceConfig.maxDockingSpeed
            }))
            .with(new HealthComponent({ hull: 1e9, maxHull: 1e9, shield: 0, maxShield: 0, shieldRegenRate: 0 }))
            .with(new PhysicsComponent({ mass: 1e9, bodyType: 'static' }))
            .with(new StaticDataComponent({ type: 'station', name: 'Trading Station' }))
            .with(new FactionComponent('CIVILIAN_FACTION'))
            .with(new MapIconComponent({ iconType: 'station', color: '#00aaff', isStatic: true }))
            .build();

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }

    _createStationCollision() {
        const collision = new CollisionComponent();
        
        // Central Hub (local space)
        collision.localVolumes.push(new THREE.Sphere(new THREE.Vector3(0, 0, 0), 35));
        
        // Torus Ring (local space)
        const torusRadius = 120;
        const torusTubeRadius = 18;
        const torusSegments = 32;
        for (let i = 0; i < torusSegments; i++) {
            const angle = (i / torusSegments) * Math.PI * 2;
            const segmentCenter = new THREE.Vector3(Math.cos(angle) * torusRadius, 0, Math.sin(angle) * torusRadius);
            collision.localVolumes.push(new THREE.Sphere(segmentCenter, torusTubeRadius));
        }

        // Connecting Spokes
        const spokeRadius = 8;
        const numSpokes = 4;
        for (let i = 0; i < numSpokes; i++) {
            const angle = (i / numSpokes) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
            for (let j = 0; j < 6; j++) {
                const spokeSegmentCenter = dir.clone().multiplyScalar(35 + j * 12.5);
                collision.localVolumes.push(new THREE.Sphere(spokeSegmentCenter, spokeRadius));
            }
        }

        return collision;
    }

    createPlanet(planetData) {
        const mesh = MeshFactory.createPlanetMesh(planetData);
        mesh.position.set(...planetData.position);

        const collision = new CollisionComponent();
        collision.boundingSphere.radius = planetData.size;

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position: mesh.position }))
            .with(new RenderComponent(mesh))
            .with(collision)
            .with(new PhysicsComponent({ mass: 1e12, bodyType: 'static' }))
            .with(new StaticDataComponent({ type: 'planet', id: planetData.id, name: planetData.name }))
            .with(new MapIconComponent({ iconType: 'circle', color: `#${planetData.color}`, isStatic: true }))
            .build();

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }

    createSun(sunData) {
        const mesh = MeshFactory.createSunMesh(sunData);
        mesh.position.set(...sunData.position);

        const collision = new CollisionComponent();
        collision.boundingSphere.radius = sunData.size;

        const entityId = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position: mesh.position }))
            .with(new RenderComponent(mesh))
            .with(collision)
            .with(new PhysicsComponent({ mass: 1e15, bodyType: 'static' }))
            .with(new StaticDataComponent({ type: 'sun', name: 'Star' }))
            .with(new MapIconComponent({ iconType: 'sun', color: `#${sunData.color}`, isStatic: true }))
            .build();


        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        return entityId;
    }
}