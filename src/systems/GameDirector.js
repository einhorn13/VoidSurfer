import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';
import { DynamicSpawner } from './DynamicSpawner.js';
import { StateComponent } from './components/StateComponent.js';

export class GameDirector {
    constructor() {
        this.dataManager = serviceLocator.get('DataManager');
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.worldManager = serviceLocator.get('WorldManager');

        this.zoneConfig = this.dataManager.getConfig('zones_config');
        this.zoneThreatLevels = new Map();
        this.inactiveNpcPool = new Map();

        this.spawner = new DynamicSpawner(this, this.dataManager.getConfig('spawn_config'));
        
        this._addEventListeners();
    }
    
    _addEventListeners() {
        eventBus.on('purchase_ship_request', (shipId) => this.purchaseShip(shipId));
        eventBus.on('player_respawn_request', () => this.handlePlayerRespawn());
        eventBus.on('npc_destroyed', (data) => this.handleNpcDestroyed(data));
    }

    init() {
        this.zoneConfig.forEach(zone => {
            this.zoneThreatLevels.set(zone.id, zone.initialThreat || 0);
        });
        this.initAsteroidBelts();
        this.spawnInitialNpcs();
    }
    
    handleNpcDestroyed({ entityId }) {
        const factionComp = this.ecsWorld.getComponent(entityId, 'FactionComponent');
        const transform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
        if (!factionComp || !transform) return;

        const zone = this.getCurrentZone(transform.position);
        if (!zone) return;

        const currentThreat = this.zoneThreatLevels.get(zone.id) || 0;
        let threatChange = 0;

        if (factionComp.name === 'PIRATE_FACTION') {
            threatChange = -0.5;
        } else if (factionComp.name === 'CIVILIAN_FACTION') {
            threatChange = 1.0;
        }
        
        this.zoneThreatLevels.set(zone.id, Math.max(0, currentThreat + threatChange));
    }

    initAsteroidBelts() {
        const asteroidTypes = ['ROCK', 'IRON'];
        asteroidTypes.forEach(typeId => {
            this.entityFactory.environment.registerInstancedMeshType(typeId);
        });

        const asteroidZones = this.zoneConfig.filter(z => z.id.includes('BELT'));
        asteroidZones.forEach(zone => {
            const center = new THREE.Vector3().fromArray(zone.position);
            const radius = zone.size;
            const count = zone.id.includes('OUTER') ? 45 : 35;

            for (let i = 0; i < count; i++) {
                const pos = new THREE.Vector3()
                    .randomDirection()
                    .multiplyScalar(Math.random() * radius)
                    .add(center);
                const type = Math.random() > 0.3 ? 'ROCK' : 'IRON';
                this.entityFactory.environment.createAsteroid(type, pos);
            }
        });
    }

    spawnInitialNpcs() {
        const stationZone = this.zoneConfig.find(z => z.id === 'STATION_TRAFFIC_ZONE');
        if (stationZone) {
            const pos = new THREE.Vector3().fromArray(stationZone.position).add(new THREE.Vector3(500, 0, 500));
            this.reactivateOrSpawnSquad(['CIV_FREIGHTER'], pos, { type: 'TRADE_RUN_STATION' });
        }

        const innerBelt = this.zoneConfig.find(z => z.id === 'INNER_BELT');
        if (innerBelt) {
            const pos = new THREE.Vector3().fromArray(innerBelt.position);
            this.reactivateOrSpawnSquad(['PIRATE_LIGHT_SCOUT'], pos, { type: 'PATROL_AREA', targetPosition: pos });
        }
    }

    update(delta, playerEntityId) {
        if (playerEntityId) {
            const playerHealth = this.ecsWorld.getComponent(playerEntityId, 'HealthComponent');
            if (playerHealth && playerHealth.state === 'ALIVE') {
                this.spawner.update(delta, playerEntityId);
            }
        }
    }

    spawnPlayer(position = new THREE.Vector3(0, 0, 0)) {
        const oldPlayerIds = this.ecsWorld.query(['PlayerControlledComponent']);
        for (const id of oldPlayerIds) {
            const health = this.ecsWorld.getComponent(id, 'HealthComponent');
            if (health) health.state = 'DESTROYED';
        }

        const playerState = this.gameStateManager.playerState;
        const options = {
            isPlayer: true,
            position: position,
            credits: playerState.credits,
            currentHull: playerState.hull,
            cargo: playerState.cargo,
            ammo: playerState.ammo
        };
        const playerEntityId = this.entityFactory.ship.createShip(playerState.shipId, options);
        return playerEntityId;
    }

    handlePlayerRespawn() {
        const shipData = this.dataManager.getShipData(this.gameStateManager.playerState.shipId);

        if (shipData) {
            this.gameStateManager.playerState.hull = shipData.hull;
        }

        const newPlayerId = this.spawnPlayer();
        eventBus.emit('player_ship_updated', newPlayerId);
    }
    
    purchaseShip(shipId) {
        const playerIds = this.ecsWorld.query(['PlayerControlledComponent']);
        if (playerIds.length === 0) return false;
        
        const playerEntityId = playerIds[0];
        const playerStats = this.ecsWorld.getComponent(playerEntityId, 'PlayerStatsComponent');
        if (!playerStats) return false;

        const newShipData = this.dataManager.getShipData(shipId);
        const cost = newShipData?.cost ?? 9999999;
        
        if (playerStats.credits >= cost) {
            playerStats.credits -= cost;
            
            const transform = this.ecsWorld.getComponent(playerEntityId, 'TransformComponent');
            const oldPosition = transform ? transform.position.clone() : new THREE.Vector3();

            const oldCargo = this.ecsWorld.getComponent(playerEntityId, 'CargoComponent');
            const oldAmmo = this.ecsWorld.getComponent(playerEntityId, 'AmmoComponent');
            
            this.gameStateManager.playerState.shipId = shipId;
            this.gameStateManager.playerState.hull = newShipData.hull;
            
            const newAmmo = { ...newShipData.ammo };
            if (oldAmmo) {
                for (const type in oldAmmo.ammo) {
                     if (newAmmo.hasOwnProperty(type)) {
                        newAmmo[type] = Math.min(newShipData.ammo[type], (newAmmo[type] || 0) + oldAmmo.ammo.get(type));
                    }
                }
            }
            this.gameStateManager.playerState.ammo = newAmmo;
            this.gameStateManager.playerState.cargo = oldCargo ? Object.fromEntries(oldCargo.items) : {};
            this.gameStateManager.playerState.credits = playerStats.credits;
            
            this.gameStateManager.saveState();
            
            const newPlayerId = this.spawnPlayer(oldPosition);
            eventBus.emit('player_ship_updated', newPlayerId);
            eventBus.emit('notification', { text: `Purchased: ${newShipData.name}`, type: 'success' });
            return true;
        }
        return false;
    }
    
    removeNpc(entityId) {
        for (const [shipId, pool] of this.inactiveNpcPool.entries()) {
            const index = pool.indexOf(entityId);
            if (index > -1) {
                pool.splice(index, 1);
            }
        }
        
        const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
        if (health && health.state === 'ALIVE') {
            health.state = 'DESTROYED';
        }
    }

    deactivateNpc(entityId) {
        const staticData = this.ecsWorld.getComponent(entityId, 'StaticDataComponent');
        if (!staticData || staticData.data.type !== 'ship') return;
        
        const shipId = staticData.data.id;
        if (!this.inactiveNpcPool.has(shipId)) {
            this.inactiveNpcPool.set(shipId, []);
        }
        this.inactiveNpcPool.get(shipId).push(entityId);

        const render = this.ecsWorld.getComponent(entityId, 'RenderComponent');
        if (render) render.isVisible = false;
        
        const transform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
        if (transform) transform.position.set(0, 0, -50000);
    }
    
    reactivateOrSpawnSquad(squad, position, objective) {
        const spawnConfig = this.dataManager.getConfig('spawn_config');
        const resolvedShips = squad.flatMap(shipType => spawnConfig.squadTypes[shipType] || [shipType]);

        const squadOffsets = [new THREE.Vector3(0,0,0)];
        if(resolvedShips.length > 1) {
            squadOffsets.push(new THREE.Vector3(-30, 10, -20));
            squadOffsets.push(new THREE.Vector3(30, -10, -20));
        }

        resolvedShips.forEach((shipId, index) => {
            const spawnPos = position.clone().add(squadOffsets[index] || new THREE.Vector3());

            if (this.inactiveNpcPool.has(shipId) && this.inactiveNpcPool.get(shipId).length > 0) {
                const entityId = this.inactiveNpcPool.get(shipId).pop();
                this.reactivateNpc(entityId, spawnPos, objective);
            } else {
                this.spawnNewNpc(shipId, spawnPos, objective);
            }
        });
    }

    reactivateNpc(entityId, position, objective) {
        const transform = this.ecsWorld.getComponent(entityId, 'TransformComponent');
        transform.position.copy(position);

        const physics = this.ecsWorld.getComponent(entityId, 'PhysicsComponent');
        physics.velocity.set(0,0,0);

        const health = this.ecsWorld.getComponent(entityId, 'HealthComponent');
        health.hull.current = health.hull.max;
        health.shield.current = health.shield.max;
        // FIX: Update health state correctly.
        health.state = 'ALIVE';
        
        const render = this.ecsWorld.getComponent(entityId, 'RenderComponent');
        render.isVisible = true;

        const state = this.ecsWorld.getComponent(entityId, 'StateComponent');
        state.states.set('OBJECTIVE', this.createObjective(objective, position));
    }

    spawnNewNpc(shipId, position, objective) {
        const options = { position };
        const entityId = this.entityFactory.ship.createShip(shipId, options);
        if (entityId) {
            const state = this.ecsWorld.getComponent(entityId, 'StateComponent');
            if (state) {
                state.states.set('OBJECTIVE', this.createObjective(objective, position));
            }
        }
    }
    
    createObjective(objective, spawnPosition) {
        if (objective.type === 'TRADE_RUN_STATION') {
            const stationTransform = this.ecsWorld.getComponent(this.worldManager.stationEntityId, 'TransformComponent');
            if (stationTransform) {
                const distToStation = spawnPosition.distanceTo(stationTransform.position);
                if (distToStation < 2000) {
                    const awayVector = new THREE.Vector3().subVectors(spawnPosition, stationTransform.position).normalize();
                    const targetPos = spawnPosition.clone().add(awayVector.multiplyScalar(8000));
                    return { type: 'NAVIGATE_TO', targetPosition: targetPos };
                } else {
                    return { type: 'NAVIGATE_TO', targetPosition: stationTransform.position.clone() };
                }
            }
        }
        return { type: objective.type, targetPosition: objective.targetPosition || spawnPosition };
    }

    getCurrentZone(position) {
        for (const zone of this.zoneConfig) {
            if (zone.shape === 'world') continue;

            const zonePos = new THREE.Vector3().fromArray(zone.position);
            if (zone.shape === 'sphere') {
                if (position.distanceTo(zonePos) < zone.size) {
                    return zone;
                }
            } else if (zone.shape === 'box') {
                const boxSize = new THREE.Vector3(zone.size, zone.size, zone.size);
                const box = new THREE.Box3().setFromCenterAndSize(zonePos, boxSize);
                if (box.containsPoint(position)) {
                    return zone;
                }
            }
        }
        return this.zoneConfig.find(z => z.shape === 'world') || null;
    }
}