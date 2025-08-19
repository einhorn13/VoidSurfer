// src/WorldManager.js
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

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
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

            if (health && health.isDestroyed) {
                continue;
            }

            // The grid's register function expects an object with an entityId and a collision component
            this.spatialGrid.register({ entityId, collision });
        }
    }
}