import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';
import { World } from './ecs/World.js';
import { Game } from './Game.js';
import { DataManager } from './DataManager.js';
import { LoadingManager } from './LoadingManager.js';
import { RendererManager } from './RendererManager.js';
import { WorldToScreenMapper } from './utils/WorldToScreenMapper.js';
import { ECSDebugger } from './ECSDebugger.js';
import { navigationService } from './NavigationService.js';

// Managers
import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';
import { Scanner } from './Scanner.js';
import { WorldManager } from './WorldManager.js';
import { ConsoleManager } from './ConsoleManager.js';
import { NotificationManager } from './NotificationManager.js';
import { HUDManager } from './HUDManager.js';
import { StationUIManager } from './StationUIManager.js';
import { WorldUIManager } from './WorldUIManager.js';
import { MinimapManager } from './MinimapManager.js';
import { SystemMapManager } from './SystemMapManager.js';
import { EntityAssembler } from './EntityAssembler.js';

// Systems
import { CooldownSystem } from './systems/CooldownSystem.js';
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
import { AISensorSystem } from './systems/AISensorSystem.js';
import { AIBehaviorSystem } from './systems/AIBehaviorSystem.js';
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
import { CommandExecutionSystem } from './systems/CommandExecutionSystem.js';

const SIMULATION_RATE = 60;
const TIME_STEP = 1.0 / SIMULATION_RATE;
const MAX_STEPS_PER_FRAME = 5;

/**
 * The main application class. Owns the game loop, renderer, and ECS world.
 * Responsible for assembling the entire application.
 */
export class Application {
    constructor() {
        this.clock = new THREE.Clock();
        this.accumulator = 0.0;
        this.game = null;
        this.ecsDebugger = null;
    }

    async init() {
        const loadingManager = new LoadingManager();
        await loadingManager.loadLibs();

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
        camera.layers.enableAll();
        
        const ecsWorld = new World();
        const dataManager = new DataManager();

        serviceLocator.register('Scene', scene);
        serviceLocator.register('Camera', camera);
        serviceLocator.register('ECSWorld', ecsWorld);
        serviceLocator.register('eventBus', eventBus);
        serviceLocator.register('DataManager', dataManager);
        serviceLocator.register('NavigationService', navigationService);

        await loadingManager.loadData(dataManager);
        
        const rendererManager = new RendererManager(scene, camera, document.body);
        serviceLocator.register('RendererManager', rendererManager);

        const entityFactory = new EntityAssembler();
        entityFactory.init();
        serviceLocator.register('EntityFactory', entityFactory);

        const worldToScreenMapper = new WorldToScreenMapper(camera);
        const worldManager = new WorldManager();
        const scanner = new Scanner(worldManager.spatialGrid, camera);
        const notificationManager = new NotificationManager();
        const gameStateManager = new GameStateManager();

        serviceLocator.register('GameStateManager', gameStateManager);
        serviceLocator.register('WorldManager', worldManager);
        serviceLocator.register('Scanner', scanner);
        serviceLocator.register('NotificationManager', notificationManager);
        serviceLocator.register('WorldToScreenMapper', worldToScreenMapper);

        const hudManager = new HUDManager(scanner, dataManager, ecsWorld);
        const minimapManager = new MinimapManager(worldManager.spatialGrid, scanner, ecsWorld);
        const systemMapManager = new SystemMapManager(scanner, ecsWorld, gameStateManager);
        serviceLocator.register('SystemMapManager', systemMapManager);
        const stationUIManager = new StationUIManager(notificationManager);
        const worldUIManager = new WorldUIManager(scanner, worldManager.spatialGrid, worldToScreenMapper, camera, ecsWorld);
        
        const uiManager = new UIManager(
            hudManager, minimapManager, systemMapManager, 
            stationUIManager, worldUIManager, notificationManager
        );
        
        this.game = new Game(ecsWorld, camera, gameStateManager, worldManager, uiManager);
        
        const gameDirector = this.game.gameDirector;
        
        this.ecsDebugger = new ECSDebugger();

        // --- Assemble ECS Systems ---
        const debugSystem = new DebugSystem(ecsWorld);
        debugSystem.ecsDebugger = this.ecsDebugger; // Link the systems

        ecsWorld.addSystem(new CooldownSystem(ecsWorld));
        ecsWorld.addSystem(new InputSystem(ecsWorld));
        ecsWorld.addSystem(new AISensorSystem(ecsWorld));
        ecsWorld.addSystem(new AIBehaviorSystem(ecsWorld));
        ecsWorld.addSystem(new CommandExecutionSystem(ecsWorld));
        ecsWorld.addSystem(new WeaponFireSystem(ecsWorld));
        ecsWorld.addSystem(new MissileSystem(ecsWorld));
        ecsWorld.addSystem(new MovementSystem(ecsWorld));
        ecsWorld.addSystem(new StationSystem(ecsWorld));
        ecsWorld.addSystem(new LifetimeSystem(ecsWorld));
        ecsWorld.addSystem(new BoundingVolumeUpdateSystem(ecsWorld));
        ecsWorld.addSystem(new ProximityFuzeSystem(ecsWorld));
        ecsWorld.addSystem(new CollisionSystem(ecsWorld));
        ecsWorld.addSystem(new HitResolverSystem(ecsWorld));
        ecsWorld.addSystem(new DamageSystem(ecsWorld));
        ecsWorld.addSystem(new LootSystem(ecsWorld));
        ecsWorld.addSystem(new RegenerationSystem(ecsWorld));
        ecsWorld.addSystem(new ItemCollectionSystem(ecsWorld));
        ecsWorld.addSystem(new PlayerRespawnSystem(ecsWorld));
        ecsWorld.addSystem(new RenderSystem(ecsWorld));
        ecsWorld.addSystem(new InstancedRenderSystem(ecsWorld));
        ecsWorld.addSystem(new EngineTrailSystem(ecsWorld));
        ecsWorld.addSystem(new EffectSystem(ecsWorld));
        ecsWorld.addSystem(new HealthBarSystem(ecsWorld));
        ecsWorld.addSystem(new DustEffectSystem(ecsWorld));
        ecsWorld.addSystem(debugSystem);
        ecsWorld.addSystem(new CleanupSystem(ecsWorld, entityFactory, gameDirector));
        
        this.game.init();
        this.ecsDebugger.init();
    }

    start() {
        this.animate();
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const delta = this.clock.getDelta();
        const gameStateManager = serviceLocator.get('GameStateManager');
        
        if (gameStateManager.getCurrentState() === 'PAUSED') {
            return;
        }

        const timeScale = gameStateManager.getSimulationSpeed();
        this.accumulator += delta * timeScale;
        
        const rendererManager = serviceLocator.get('RendererManager');
        
        let steps = 0;
        // Limit steps per frame to avoid spiral of death on low FPS with high time scale
        const maxSteps = MAX_STEPS_PER_FRAME * (timeScale > 1 ? timeScale : 1);
        while (this.accumulator >= TIME_STEP && steps < maxSteps) {
            this.game.update(TIME_STEP);
            this.accumulator -= TIME_STEP;
            steps++;
        }
        
        this.game.updateUI(delta);
        rendererManager.render(delta);
    }
}