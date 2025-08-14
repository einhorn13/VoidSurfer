import * as THREE from 'three';
import { PlayerController } from './PlayerController.js';
import { ProjectileManager } from './ProjectileManager.js';
import { EffectsManager } from './EffectsManager.js';
import { GameStateManager } from './GameStateManager.js';
import { UIManager } from './UIManager.js';
import { Scanner } from './Scanner.js';
import { WorldManager } from './WorldManager.js';
import { keyState } from './InputController.js';
import { ConsoleManager } from './ConsoleManager.js';
import { RendererManager } from './RendererManager.js';

export class Game {
    constructor(dataManager) {
        this.dataManager = dataManager;
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.camera.layers.enableAll();
        
        this.clock = new THREE.Clock();

        this.initHTML();
        // --- REFACTORED: Renderer setup is now handled by its own manager ---
        this.rendererManager = new RendererManager(this.scene, this.camera, document.body);
        
        this.initEnvironment();
        this.initManagers();
        this.initWorld();
        this.initPlayer();
        this.initEventListeners();
    }
    
    initHTML() {
        // This method now only creates the DOM elements for the UI.
        // The main canvas is appended by the RendererManager.
        const uiHTML = `
            <div id="damage-overlay"></div>
            <div id="hud"><canvas id="hud-canvas"></canvas></div>
            <div id="dock-prompt">Press 'G' to Dock</div>
            <div id="station-menu">
                <h2>Station Services</h2>
                <button id="btn-repair">Repair Hull <span class="cost" id="cost-repair">0 CR</span></button>
                <button id="btn-rearm">Rearm <span class="cost" id="cost-rearm">0 CR</span></button>
                <button id="btn-shipyard">Shipyard</button>
                <button id="btn-undock">Undock</button>
            </div>
            <div id="shipyard-menu">
                <h2>Shipyard</h2>
                <ul id="shipyard-list"></ul>
                <button id="btn-shipyard-back" style="margin-top: 15px;">Back to Services</button>
            </div>
            <div id="scanner-container"></div>
            <div id="nav-pointer">[+]</div>
            <div id="console-container">
                <ul id="console-output"></ul>
                <div id="console-input-wrapper">
                    <span>></span>
                    <input type="text" id="console-input" autocomplete="off" />
                </div>
            </div>
            <div id="mouse-cursor"></div>
        `;
        document.body.insertAdjacentHTML('beforeend', uiHTML);
    }

    initEnvironment() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.15)); 

        const starGeometry = new THREE.BufferGeometry();
        const starVertices = [];
        for (let i = 0; i < 5000; i++) {
            starVertices.push(
                THREE.MathUtils.randFloatSpread(18000),
                THREE.MathUtils.randFloatSpread(18000),
                THREE.MathUtils.randFloatSpread(18000)
            );
        }
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 4.0, sizeAttenuation: false });
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);

        const dustGeometry = new THREE.BufferGeometry();
        const dustVertices = [];
        for (let i = 0; i < 1000; i++) { 
            dustVertices.push(
                THREE.MathUtils.randFloatSpread(1200),
                THREE.MathUtils.randFloatSpread(1200),
                THREE.MathUtils.randFloatSpread(1200)
            );
        }
        dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustVertices, 3));
        const dustMaterial = new THREE.PointsMaterial({ 
            color: 0xaaaaaa, 
            size: 0.5, 
            transparent: true, 
            opacity: 0.7,
            sizeAttenuation: false 
        });
        this.dust = new THREE.Points(dustGeometry, dustMaterial);
        this.scene.add(this.dust);
    }

    initManagers() {
        this.gameStateManager = new GameStateManager(this.dataManager);
        this.projectileManager = new ProjectileManager(this.scene);
        this.uiManager = new UIManager(this.gameStateManager, this.dock.bind(this), this.undock.bind(this), this.purchaseShip.bind(this), this.dataManager);
        this.effectsManager = new EffectsManager(this.scene, this.uiManager);
        this.worldManager = new WorldManager(this.scene, this.projectileManager, this.effectsManager, this.gameStateManager, this.dataManager);
        this.scanner = new Scanner();
        
        this.consoleManager = new ConsoleManager(this.gameStateManager, this.worldManager);
        window.log = this.consoleManager.log.bind(this.consoleManager);
    }

    initWorld() {
        this.worldManager.initWorld();
        this.spaceStation = this.worldManager.spaceStation;
    }

    initPlayer() {
        this.playerShip = this.worldManager.spawnPlayer();
        this.playerController = new PlayerController(
            this.playerShip,
            this.camera,
            this.projectileManager,
            this.gameStateManager,
            this.scanner,
            this.worldManager
        );
        this.uiManager.setPlayerShip(this.playerShip);
        this.scanner.setNavTarget(this.spaceStation);
    }

    initEventListeners() {
        // --- REFACTORED: This listener now only handles UI canvas resizing. ---
        // The main 3D canvas is handled by RendererManager.
        window.addEventListener('resize', () => {
            if (this.uiManager && this.uiManager.hudCanvas) {
                this.uiManager.hudCanvas.width = this.uiManager.hudCanvas.clientWidth * window.devicePixelRatio;
                this.uiManager.hudCanvas.height = this.uiManager.hudCanvas.clientHeight * window.devicePixelRatio;
                this.uiManager.hudCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
            }
        });
    }

    dock() {
        this.gameStateManager.setDocked(true, this.playerShip);
        this.playerShip.velocity.set(0, 0, 0);
        this.uiManager.showStationMenu();
    }

    undock() {
        this.gameStateManager.setDocked(false, this.playerShip);
        this.uiManager.hideStationUI();
    }

    purchaseShip(shipId) {
        const shipData = this.dataManager.getShipData(shipId);
        const cost = shipData?.cost ?? 9999999;
        if (this.gameStateManager.removeCredits(cost)) {
            this.gameStateManager.playerState.shipId = shipId;
            this.gameStateManager.playerState.hull = shipData.hull;
            this.gameStateManager.playerState.ammo = { ...shipData.ammo };
            this.gameStateManager.playerState.cargo = {};
            this.gameStateManager.saveState();

            const newPlayerShip = this.worldManager.spawnPlayer();
            this.playerShip = newPlayerShip;
            this.playerController.ship = newPlayerShip;
            this.uiManager.setPlayerShip(newPlayerShip);
            return true;
        }
        return false;
    }

    start() {
        this.animate();
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();

        if (this.gameStateManager.isPlayerControlEnabled) {
            this.playerController.update(delta);
        }

        const worldUpdateResult = this.worldManager.update(delta);
        
        if (worldUpdateResult.needsRespawn) {
            const newPlayerShip = this.worldManager.spawnPlayer();
            this.playerShip = newPlayerShip;
            this.playerController.ship = newPlayerShip;
            this.uiManager.setPlayerShip(newPlayerShip);
        }

        this.effectsManager.update(delta);
        if (this.playerShip && !this.playerShip.isDestroyed) {
             this.scanner.update(this.playerShip, this.worldManager.allShips);
        }

        if (this.dust) {
            this.dust.position.copy(this.camera.position);
        }

        this.uiManager.updateHud();
        this.uiManager.updateScanner(this.scanner, this.camera);

        if (!this.gameStateManager.isDocked) {
            const isDockingPossible = this.spaceStation.canDock(this.playerShip);
            this.uiManager.toggleDockingPrompt(isDockingPossible);
            if (isDockingPossible && keyState['g']) {
                keyState['g'] = false;
                this.dock();
            }
        }

        // --- REFACTORED: Single call to the renderer manager ---
        this.rendererManager.render(delta);
    }
}