// src/UIManager.js
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';

/**
 * Main UI coordinator. Coordinates specialized UI managers and handles global UI events.
 */
export class UIManager {
    constructor() {
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.notificationManager = serviceLocator.get('NotificationManager');
        this.hudManager = serviceLocator.get('HUDManager');
        this.stationUIManager = serviceLocator.get('StationUIManager');
        this.worldUIManager = serviceLocator.get('WorldUIManager');

        this.damageOverlay = document.getElementById('damage-overlay');
        this.mouseCursor = document.getElementById('mouse-cursor');
        this.notificationLog = document.getElementById('notification-log');
        
        this.playerEntityId = null;
        
        this._addEventListeners();
    }
    
    _addEventListeners() {
        window.addEventListener('mousemove', (e) => {
            if (this.mouseCursor) {
                this.mouseCursor.style.left = `${e.clientX}px`;
                this.mouseCursor.style.top = `${e.clientY}px`;
            }
        });

        eventBus.on('player_ship_updated', (entityId) => this.setPlayerShip(entityId));
        eventBus.on('game_state_changed', (newState) => this.onGameStateChanged(newState));
        eventBus.on('docking_prompt_update', (show) => this.stationUIManager.toggleDockingPrompt(show));
        eventBus.on('window_resized', () => this.resize());
        eventBus.on('player_damage_effect', () => this.showDamageFlash());
    }

    onGameStateChanged(newState) {
        if (newState === 'DOCKED') {
            this.stationUIManager.showStationMenu();
        } else {
            this.stationUIManager.hideStationUI();
        }

        const isUiVisible = (newState === 'DOCKED' || newState === 'CONSOLE');
        this.mouseCursor.style.display = isUiVisible ? 'none' : 'block';
        document.body.style.cursor = isUiVisible ? 'default' : 'none';
    }

    setPlayerShip(playerEntityId) {
        this.playerEntityId = playerEntityId;
        this.stationUIManager.setPlayerShip(playerEntityId);
        this.worldUIManager.setPlayerShip(playerEntityId);
    }

    update(delta) {
        this.hudManager.update(this.playerEntityId, this.gameStateManager.playerState);
        this.worldUIManager.update();
        this.updateNotifications();
    }
    
    showDamageFlash() {
        this.damageOverlay.style.opacity = '0.7';
        setTimeout(() => { this.damageOverlay.style.opacity = '0'; }, 100);
    }

    resize() {
        this.hudManager.resize();
    }

    updateNotifications() {
        if (!this.notificationLog || !this.notificationManager) return;
        
        const messages = this.notificationManager.getLogMessages();
        let html = '';
        
        for (const msg of messages) {
            const opacity = msg.life < 1 ? msg.life : 1;
            html += `<div class="log-message type-${msg.type}" style="opacity: ${opacity};">${msg.text}</div>`;
        }
        
        this.notificationLog.innerHTML = html;
    }
}