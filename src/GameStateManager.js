import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';

const DEFAULT_SHIP_ID = 'VIPER_MK2';

const GAME_STATES = {
    PLAYING: 'PLAYING',
    DOCKED: 'DOCKED',
    CONSOLE: 'CONSOLE',
    MAP: 'MAP',
    PAUSED: 'PAUSED'
};

const SIMULATION_SPEEDS = [1, 2, 4, 8, 16];

export class GameStateManager {
    constructor() {
        this.dataManager = serviceLocator.get('DataManager');
        this.ecsWorld = null;
        this.playerState = {};
        this.currentState = GAME_STATES.PLAYING;

        this.settings = {
            arcadeMode: true,
            simulationSpeedIndex: 0
        };

        this.loadState();
        this._addEventListeners();
    }

    _getECSWorld() {
        if (!this.ecsWorld) {
            this.ecsWorld = serviceLocator.get('ECSWorld');
        }
        return this.ecsWorld;
    }

    _addEventListeners() {
        eventBus.on('dock_request', () => this.setState(GAME_STATES.DOCKED));
        eventBus.on('undock_request', () => this.setState(GAME_STATES.PLAYING));
    }

    setArcadeMode(isEnabled) {
        this.settings.arcadeMode = isEnabled;
        eventBus.emit('notification', { 
            text: `Arcade Mode: ${isEnabled ? 'ON' : 'OFF'}`, 
            type: 'info' 
        });
    }

    isArcadeMode() {
        return this.settings.arcadeMode;
    }
    
    getSimulationSpeed() {
        return SIMULATION_SPEEDS[this.settings.simulationSpeedIndex];
    }

    increaseSimulationSpeed() {
        this.settings.simulationSpeedIndex = Math.min(this.settings.simulationSpeedIndex + 1, SIMULATION_SPEEDS.length - 1);
        this._notifySpeedChange();
    }

    decreaseSimulationSpeed() {
        this.settings.simulationSpeedIndex = Math.max(0, this.settings.simulationSpeedIndex - 1);
        this._notifySpeedChange();
    }
    
    resetSimulationSpeed() {
        if (this.settings.simulationSpeedIndex !== 0) {
            this.settings.simulationSpeedIndex = 0;
            this._notifySpeedChange();
        }
    }

    _notifySpeedChange() {
        const speed = this.getSimulationSpeed();
        eventBus.emit('notification', { text: `Simulation Speed: ${speed}x`, type: 'info' });
    }

    loadState() {
        this.resetPlayerState();
    }

    saveState() {
        const ecs = this._getECSWorld();
        if (!ecs) return;
        
        const playerIds = ecs.query(['PlayerControlledComponent']);
        if (playerIds.length === 0) return;
        
        this.updatePlayerStateFromECS(playerIds[0]);
        console.log("State saved (simulation):", this.playerState);
    }

    resetPlayerState() {
        const defaultShip = this.dataManager.getShipData(DEFAULT_SHIP_ID);
        this.playerState = {
            credits: 100,
            shipId: DEFAULT_SHIP_ID,
            hull: defaultShip.hull,
            cargo: {},
            ammo: { ...defaultShip.ammo }
        };
    }

    setState(newState) {
        if (this.currentState === newState || !Object.values(GAME_STATES).includes(newState)) {
            return;
        }
        this.currentState = newState;
        console.log(`Game state changed to: ${this.currentState}`);
        eventBus.emit('game_state_changed', this.currentState);
    }
    
    getCurrentState() {
        return this.currentState;
    }
    
    isPlayerControlEnabled() {
        return this.currentState === GAME_STATES.PLAYING;
    }
    
    setConsoleOpen(isOpen) {
        if (isOpen) {
            this.setState(GAME_STATES.CONSOLE);
        } else if (this.currentState === GAME_STATES.CONSOLE) {
            this.setState(GAME_STATES.PLAYING);
        }
    }

    setMapOpen(isOpen) {
        if (isOpen) {
            this.setState(GAME_STATES.MAP);
        } else if (this.currentState === GAME_STATES.MAP) {
            this.setState(GAME_STATES.PLAYING);
        }
    }

    updatePlayerStateFromECS(playerEntityId) {
        const ecs = this._getECSWorld();
        const health = ecs.getComponent(playerEntityId, 'HealthComponent');
        const cargo = ecs.getComponent(playerEntityId, 'CargoComponent');
        const ammo = ecs.getComponent(playerEntityId, 'AmmoComponent');
        const staticData = ecs.getComponent(playerEntityId, 'StaticDataComponent');
        const stats = ecs.getComponent(playerEntityId, 'PlayerStatsComponent');

        if (!health || !cargo || !ammo || !staticData || !stats) {
            console.warn("Could not update player state from ECS: components missing.");
            return;
        }
        this.playerState.shipId = staticData.data.id;
        this.playerState.hull = health.hull.current;
        this.playerState.cargo = Object.fromEntries(cargo.items);
        this.playerState.ammo = Object.fromEntries(ammo.ammo);
        this.playerState.credits = stats.credits;
    }
}