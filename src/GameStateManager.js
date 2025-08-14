// src/GameStateManager.js

const DEFAULT_SHIP_ID = 'VIPER_MK2';

export class GameStateManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.playerState = {};
        this.isDocked = false;
        this.isConsoleOpen = false;
        this.isPlayerControlEnabled = true;

        this.loadState();
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
    
    _updateControlState() {
        this.isPlayerControlEnabled = !this.isDocked && !this.isConsoleOpen;
    }

    setConsoleOpen(isOpen) {
        this.isConsoleOpen = isOpen;
        this._updateControlState();
    }

    updatePlayerShipState(playerShip) {
        if (!playerShip || playerShip.isDestroyed) {
            this.resetPlayerState();
            return;
        }
        this.playerState.shipId = playerShip.id;
        this.playerState.hull = playerShip.hull;
        this.playerState.cargo = Object.fromEntries(playerShip.cargoHold);
        this.playerState.ammo = Object.fromEntries(playerShip.ammo);
        this.saveState();
    }

    addCredits(amount) {
        this.playerState.credits += amount;
        this.saveState();
    }

    removeCredits(amount) {
        if (this.playerState.credits >= amount) {
            this.playerState.credits -= amount;
            this.saveState();
            return true;
        }
        return false;
    }

    setDocked(isDocked, playerShip) {
        this.isDocked = isDocked;
        this._updateControlState();
        if (playerShip) {
            this.updatePlayerShipState(playerShip);
        }
    }
}