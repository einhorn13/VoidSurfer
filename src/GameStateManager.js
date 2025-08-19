// src/GameStateManager.js
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';

const DEFAULT_SHIP_ID = 'VIPER_MK2';

const GAME_STATES = {
    PLAYING: 'PLAYING',
    DOCKED: 'DOCKED',
    CONSOLE: 'CONSOLE',
    PAUSED: 'PAUSED'
};

export class GameStateManager {
    constructor() {
        this.dataManager = serviceLocator.get('DataManager');
        this.ecsWorld = serviceLocator.get('ECSWorld'); // Get ECS world
        this.playerState = {};
        this.currentState = GAME_STATES.PLAYING;

        this.settings = {
            arcadeMode: true 
        };

        this.loadState();
        this._addEventListeners();
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

    loadState() {
        this.resetPlayerState();
    }

    saveState() {
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
        this.saveState();
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

    updatePlayerShipState(playerEntityId) {
        const health = this.ecsWorld.getComponent(playerEntityId, 'HealthComponent');
        const cargo = this.ecsWorld.getComponent(playerEntityId, 'CargoComponent');
        const ammo = this.ecsWorld.getComponent(playerEntityId, 'AmmoComponent');
        const staticData = this.ecsWorld.getComponent(playerEntityId, 'StaticDataComponent');

        if (!health || !cargo || !ammo || !staticData) {
            this.resetPlayerState();
            return;
        }
        this.playerState.shipId = staticData.data.id;
        this.playerState.hull = health.hull.current;
        this.playerState.cargo = Object.fromEntries(cargo.items);
        this.playerState.ammo = Object.fromEntries(ammo.ammo);
        this.saveState();
    }

    addCredits(amount) {
        this.playerState.credits += amount;
        this.saveState();
        eventBus.emit('player_stats_updated', this.playerState);
    }

    removeCredits(amount) {
        if (this.playerState.credits >= amount) {
            this.playerState.credits -= amount;
            this.saveState();
            eventBus.emit('player_stats_updated', this.playerState);
            return true;
        }
        return false;
    }
}