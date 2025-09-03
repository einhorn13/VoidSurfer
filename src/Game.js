import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';
import { GameDirector } from './GameDirector.js';
import { CameraController } from './CameraController.js';
import { DustEffectComponent } from './components/DustEffectComponent.js';
import { ConsoleManager } from './ConsoleManager.js';

/**
 * Manages the high-level game state and logic.
 * Assembled and run by the Application class.
 */
export class Game {
    constructor(ecsWorld, camera, gameStateManager, worldManager, uiManager) {
        this.ecsWorld = ecsWorld;
        this.camera = camera;
        this.gameStateManager = gameStateManager;
        this.worldManager = worldManager;
        this.uiManager = uiManager;
        
        this.scene = serviceLocator.get('Scene');
        this.playerEntityId = null;

        this.cameraController = null;
        this.gameDirector = new GameDirector();
        this.consoleManager = new ConsoleManager();
        
        serviceLocator.register('GameDirector', this.gameDirector);

        eventBus.on('player_ship_updated', (entityId) => {
            this.playerEntityId = entityId;
            if (this.cameraController) {
                this.cameraController.setTarget(entityId);
            }
            this.uiManager.setPlayerShip(entityId);
        });
    }

    init() {
        this._initEnvironment();
        this.worldManager.initWorld();
        this.gameDirector.init();
        this._initPlayer();
    }

    _initEnvironment() {
        this.scene.add(new THREE.AmbientLight(0xaaaaff, 0.1));

        const cubeTextureLoader = new THREE.CubeTextureLoader();
        cubeTextureLoader.setPath('assets/skybox/');
        const textureCube = cubeTextureLoader.load(['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png']);
        this.scene.background = textureCube;

        const effectEntity = this.ecsWorld.createEntity()
            .with(new DustEffectComponent())
            .build();
    }

    _initPlayer() {
        const playerEntityId = this.gameDirector.spawnPlayer();
        this.cameraController = new CameraController(this.camera, playerEntityId);
        eventBus.emit('player_ship_updated', playerEntityId);
    }

    update(delta) {
        const scanner = serviceLocator.get('Scanner');
        const allTargetableIds = this.ecsWorld.query(['HealthComponent', 'CollisionComponent', 'StaticDataComponent']);
        scanner.update(delta, this.playerEntityId, allTargetableIds);

        if (this.cameraController) {
            this.cameraController.update(delta);
        }
        
        this.gameDirector.update(delta, this.playerEntityId);
        this.worldManager.update(delta);
        this.ecsWorld.update(delta);
    }
    
    updateUI(delta) {
        const systemMapManager = serviceLocator.get('SystemMapManager');
        systemMapManager.update();
        this.uiManager.update(delta);
    }
}