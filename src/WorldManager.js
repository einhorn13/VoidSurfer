import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { SpatialGrid } from './SpatialGrid.js';

export class WorldManager {
    constructor() {
        this.scene = serviceLocator.get('Scene');
        this.dataManager = serviceLocator.get('DataManager');
        this.ecsWorld = serviceLocator.get('ECSWorld');
        
        this.stationEntityId = null;
        this.celestialBodyEntityIds = [];

        this.spatialGrid = new SpatialGrid();
    }

    initWorld() {
        this.initCelestialBodies();
        
        const entityFactory = serviceLocator.get('EntityFactory');
        this.stationEntityId = entityFactory.environment.createStation(new THREE.Vector3(800, 100, -1500));
    }

    initCelestialBodies() {
        const systemConfig = this.dataManager.getConfig('system_config');
        if (!systemConfig) {
            console.error("System configuration not found!");
            return;
        }

        const entityFactory = serviceLocator.get('EntityFactory');

        const sunId = entityFactory.environment.createSun(systemConfig.sun);
        this.celestialBodyEntityIds.push(sunId);

        const directionalLight = new THREE.DirectionalLight(0xffffdd, 1.5);
        directionalLight.position.set(...systemConfig.sun.position);
        this.scene.add(directionalLight);

        systemConfig.planets.forEach(planetData => {
            const planetId = entityFactory.environment.createPlanet(planetData);
            this.celestialBodyEntityIds.push(planetId);
            
            if (planetData.moons) {
                const planetPosition = new THREE.Vector3(...planetData.position);
                planetData.moons.forEach(moonData => {
                    const moonPosition = new THREE.Vector3(...moonData.position).add(planetPosition);
                    const fullMoonData = { ...moonData, position: moonPosition.toArray() };
                    const moonId = entityFactory.environment.createPlanet(fullMoonData);
                    this.celestialBodyEntityIds.push(moonId);
                });
            }
        });
    }

    update(delta) {
        this.updateSpatialGrid();
    }

    updateSpatialGrid() {
        this.spatialGrid.clear();
        const entities = this.ecsWorld.query(['CollisionComponent', 'TransformComponent']);
        for (const entityId of entities) {
            const collision = this.ecsWorld.getComponent(entityId, 'CollisionComponent');
            const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');

            if (health && health.state !== 'ALIVE') {
                continue;
            }

            let category = 'other';
            const staticData = this.ecsWorld.getComponent(entityId, 'StaticDataComponent');
            const staticType = staticData?.data?.type;

            if (this.ecsWorld.getComponent(entityId, 'AIControlledComponent')) {
                category = 'ship';
            } else if (this.ecsWorld.getComponent(entityId, 'PlayerControlledComponent')) {
                category = 'ship';
            } else if (staticType === 'asteroid') {
                category = 'asteroid';
            } else if (this.ecsWorld.getComponent(entityId, 'CollectibleComponent')) {
                category = 'collectible';
            } else if (staticType === 'station') {
                category = 'station';
            } else if (staticType === 'missile' || staticType === 'projectile_pooled') {
                category = 'projectile';
            }

            this.spatialGrid.register({ entityId, collision }, category);
        }
    }
}