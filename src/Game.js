// src/Game.js
import * as THREE from 'three';
import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';
import { Scanner } from './Scanner.js';
import { WorldManager } from './WorldManager.js';
import { keyState } from './InputController.js';
import { ConsoleManager } from './ConsoleManager.js';
import { RendererManager } from './RendererManager.js';
import { NotificationManager } from './NotificationManager.js';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';
import { HUDManager } from './HUDManager.js';
import { StationUIManager } from './StationUIManager.js';
import { WorldUIManager } from './WorldUIManager.js';
import { CameraController } from './CameraController.js';
import { World } from './ecs/World.js';
import { EntityAssembler } from './EntityAssembler.js';
import { GameDirector } from './GameDirector.js';
import { DustEffectComponent } from './components/DustEffectComponent.js';

// Systems
import { RegenerationSystem } from './systems/RegenerationSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { LootSystem } from './systems/LootSystem.js';
import { CleanupSystem } from './systems/CleanupSystem.js';
import { DamageSystem } from './systems/DamageSystem.js';
import { MissileSystem } from './systems/MissileSystem.js';
import { StationSystem } from './systems/StationSystem.js';
import { InstancedRenderSystem } from './systems/InstancedRenderSystem.js';
import { EffectSystem } from './systems/EffectSystem.js';
import { EngineTrailSystem } from './systems/EngineTrailSystem.js';
import { InputSystem } from './systems/InputSystem.js';
import { AISystem } from './systems/AISystem.js';
import { HealthBarSystem } from './systems/HealthBarSystem.js';
import { ItemCollectionSystem } from './systems/ItemCollectionSystem.js';
import { PlayerRespawnSystem } from './systems/PlayerRespawnSystem.js';
import { WeaponFireSystem } from './systems/WeaponFireSystem.js';
import { HitResolverSystem } from './systems/HitResolverSystem.js';
import { ProximityFuzeSystem } from './systems/ProximityFuzeSystem.js';
import { BoundingVolumeUpdateSystem } from './systems/BoundingVolumeUpdateSystem.js';
import { LifetimeSystem } from './systems/LifetimeSystem.js';
import { DustEffectSystem } from './systems/DustEffectSystem.js';
import { DebugSystem } from './systems/DebugSystem.js';


const SIMULATION_RATE = 60;
const TIME_STEP = 1.0 / SIMULATION_RATE;

export class Game {
    constructor() {
        this.dataManager = serviceLocator.get('DataManager');
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.camera.layers.enableAll();
        
        this.clock = new THREE.Clock();
        this.accumulator = 0.0;

        this.renderInterval = 1.0 / 60.0;
        this.renderAccumulator = 0;

        this.ecsWorld = new World();
        serviceLocator.register('ECSWorld', this.ecsWorld);

        this.playerEntityId = null;

        this.initManagers();
        this.initECSSystems();
        
        this.initEnvironment();
        this.worldManager.initWorld();
        this.gameDirector.init();
        this.initPlayer();
        this.initEventListeners();
    }

    initEnvironment() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));

        const cubeTextureLoader = new THREE.CubeTextureLoader();
        cubeTextureLoader.setPath('assets/skybox/');
        const textureCube = cubeTextureLoader.load([
            'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'
        ]);
        this.scene.background = textureCube;

        const effectEntity = this.ecsWorld.createEntity();
        this.ecsWorld.addComponent(effectEntity, new DustEffectComponent());
    }

    initManagers() {
        serviceLocator.register('Scene', this.scene);
        serviceLocator.register('Camera', this.camera);
        serviceLocator.register('RendererManager', new RendererManager(this.scene, this.camera, document.body));
        serviceLocator.register('NotificationManager', new NotificationManager());
        serviceLocator.register('eventBus', eventBus);
        serviceLocator.register('GameStateManager', new GameStateManager());
        
        serviceLocator.register('EntityFactory', new EntityAssembler());
        
        this.damageSystem = new DamageSystem(this.ecsWorld);
        
        this.worldManager = new WorldManager();
        serviceLocator.register('WorldManager', this.worldManager);
        this.gameDirector = new GameDirector();
        serviceLocator.register('GameDirector', this.gameDirector);
        
        serviceLocator.register('Scanner', new Scanner());

        serviceLocator.register('HUDManager', new HUDManager());
        serviceLocator.register('StationUIManager', new StationUIManager());
        serviceLocator.register('WorldUIManager', new WorldUIManager());
        
        this.uiManager = new UIManager();
        serviceLocator.register('UIManager', this.uiManager);

        serviceLocator.register('ConsoleManager', new ConsoleManager());
    }

    initECSSystems() {
        // --- FINAL CORRECT SYSTEM ORDER ---

        // 1. Input & AI: Decide actions for this frame.
        this.ecsWorld.addSystem(new InputSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new AISystem(this.ecsWorld));
        
        // 2. Firing: Process actions and create projectiles/events.
        this.ecsWorld.addSystem(new WeaponFireSystem(this.ecsWorld));

        // 3. Movement & Physics: Update all logical positions and rotations.
        this.ecsWorld.addSystem(new MissileSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new MovementSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new StationSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new LifetimeSystem(this.ecsWorld));

        // 4. Bounding Volumes: Update all collision spheres based on new logical positions.
        this.ecsWorld.addSystem(new BoundingVolumeUpdateSystem(this.ecsWorld));

        // 5. Collision Detection & Resolution: Check for hits using up-to-date volumes.
        this.ecsWorld.addSystem(new ProximityFuzeSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new CollisionSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new HitResolverSystem(this.ecsWorld));
        this.ecsWorld.addSystem(this.damageSystem);

        // 6. State & Item Management: Handle consequences of collisions.
        this.ecsWorld.addSystem(new LootSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new RegenerationSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new ItemCollectionSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new PlayerRespawnSystem(this.ecsWorld));
        
        // 7. Rendering & Effects: Update visuals based on the final state of the frame.
        this.ecsWorld.addSystem(new RenderSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new InstancedRenderSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new EngineTrailSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new EffectSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new HealthBarSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new DustEffectSystem(this.ecsWorld));
        this.ecsWorld.addSystem(new DebugSystem(this.ecsWorld)); // ADDED: Debug System

        // 8. Cleanup (runs last): Remove all entities marked for deletion.
        this.ecsWorld.addSystem(new CleanupSystem(this.ecsWorld));
    }

    initPlayer() {
        this.playerEntityId = this.gameDirector.spawnPlayer();
        this.cameraController = new CameraController(this.camera, this.playerEntityId);
        eventBus.emit('player_ship_updated', this.playerEntityId);
    }

    initEventListeners() {
        window.addEventListener('resize', () => eventBus.emit('window_resized'));
        eventBus.on('purchase_ship_request', (shipId) => this.purchaseShip(shipId));
        eventBus.on('player_respawn_request', () => this.handlePlayerRespawn());
    }

    handlePlayerRespawn() {
        const gameStateManager = serviceLocator.get('GameStateManager');
        const dataManager = serviceLocator.get('DataManager');
        const shipData = dataManager.getShipData(gameStateManager.playerState.shipId);

        // FIX: Reset the hull in the persistent state to its maximum before spawning.
        if (shipData) {
            gameStateManager.playerState.hull = shipData.hull;
        }

        // Now, spawn the player. The GameDirector will use the corrected state.
        this.playerEntityId = this.gameDirector.spawnPlayer();
        this.cameraController.setTarget(this.playerEntityId);
        eventBus.emit('player_ship_updated', this.playerEntityId);
    }

    purchaseShip(shipId) {
        const gameStateManager = serviceLocator.get('GameStateManager');
        const shipData = this.dataManager.getShipData(shipId);
        const cost = shipData?.cost ?? 9999999;
        
        if (gameStateManager.removeCredits(cost)) {
            gameStateManager.playerState.shipId = shipId;
            gameStateManager.playerState.hull = shipData.hull;
            gameStateManager.playerState.ammo = { ...shipData.ammo };
            gameStateManager.playerState.cargo = {};
            gameStateManager.saveState();
            this.handlePlayerRespawn();
            eventBus.emit('notification', { text: `Purchased: ${shipData.name}`, type: 'success' });
            return true;
        }
        return false;
    }

    start() { this.animate(); }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const delta = this.clock.getDelta();
        this.renderAccumulator += delta;
        if (this.renderAccumulator < this.renderInterval) { return; }
        
        const frameTime = this.renderAccumulator;
        this.accumulator += frameTime;
        this.renderAccumulator = 0;
        
        const gameStateManager = serviceLocator.get('GameStateManager');
        const notificationManager = serviceLocator.get('NotificationManager');
        const rendererManager = serviceLocator.get('RendererManager');
        const scanner = serviceLocator.get('Scanner');
        
        while (this.accumulator >= TIME_STEP) {
            const stepDelta = TIME_STEP;
            notificationManager.update(stepDelta);
            this.cameraController.update(stepDelta);
            this.gameDirector.update(stepDelta);
            this.worldManager.update(stepDelta);
            this.ecsWorld.update(stepDelta);
            
            const playerHealth = this.ecsWorld.getComponent(this.playerEntityId, 'HealthComponent');
            const playerIsAlive = playerHealth && !playerHealth.isDestroyed;

            if (playerIsAlive) {
                const shipIds = this.ecsWorld.query(['ShipTag']);
                const asteroidIds = this.ecsWorld.query(['AsteroidTag']);
                const stationIds = this.ecsWorld.query(['StationComponent']);
                const collectibleIds = this.ecsWorld.query(['CollectibleComponent']);
                const targetables = [...shipIds, ...asteroidIds, ...stationIds, ...collectibleIds];
                scanner.update(this.playerEntityId, targetables);
            }
            
            // FIX: Removed direct input handling. This is now managed by InputSystem.
            this.accumulator -= TIME_STEP;
        }
        
        this.uiManager.update(frameTime);
        rendererManager.render(frameTime);
    }
}