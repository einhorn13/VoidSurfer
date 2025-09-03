import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';

/**
 * Main UI coordinator. Coordinates specialized UI managers and handles global UI events.
 */
export class UIManager {
    constructor(hudManager, minimapManager, systemMapManager, stationUIManager, worldUIManager, notificationManager) {
        this.ecsWorld = serviceLocator.get('ECSWorld');
        
        this.hudManager = hudManager;
        this.minimapManager = minimapManager;
        this.systemMapManager = systemMapManager;
        this.stationUIManager = stationUIManager;
        this.worldUIManager = worldUIManager;
        this.notificationManager = notificationManager;
        
        this.damageOverlay = document.getElementById('damage-overlay');
        this.mouseCursor = document.getElementById('mouse-cursor');
        this.notificationLog = document.getElementById('notification-log');
        
        this.notificationElements = [];
        this._initNotificationPool();
        
        this.playerEntityId = null;
        
        this._addEventListeners();
    }
    
    _initNotificationPool() {
        for (let i = 0; i < 5; i++) {
            const el = document.createElement('div');
            el.className = 'log-message';
            el.style.display = 'none';
            this.notificationLog.appendChild(el);
            this.notificationElements.push(el);
        }
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
        window.addEventListener('resize', () => this.resize());
        eventBus.on('player_damage_effect', () => this.showDamageFlash());
    }

    onGameStateChanged(newState) {
        if (newState === 'DOCKED') {
            this.stationUIManager.showStationMenu();
        } else {
            this.stationUIManager.hideStationUI();
        }

        const isUiVisible = (newState === 'DOCKED' || newState === 'CONSOLE' || newState === 'MAP');
        this.mouseCursor.style.display = isUiVisible ? 'none' : 'block';
        document.body.style.cursor = isUiVisible ? 'default' : 'none';
    }

    setPlayerShip(playerEntityId) {
        this.playerEntityId = playerEntityId;
        this.stationUIManager.setPlayerShip(playerEntityId);
        this.worldUIManager.setPlayerShip(playerEntityId);
    }

    update(delta) {
        this.notificationManager.update(delta);
        this.hudManager.update(this.playerEntityId);
        this.minimapManager.update(delta, this.playerEntityId);
        this.worldUIManager.update();
        this.updateNotifications();
    }
    
    showDamageFlash() {
        this.damageOverlay.style.opacity = '0.7';
        setTimeout(() => { this.damageOverlay.style.opacity = '0'; }, 100);
    }

    resize() {
        this.hudManager.resize();
        this.worldUIManager.resize();
    }

    updateNotifications() {
        if (!this.notificationLog || !this.notificationManager) return;
        
        const messages = this.notificationManager.getLogMessages();
        
        this.notificationElements.forEach((el, index) => {
            const msg = messages[index];
            if (msg) {
                const opacity = msg.life < 1 ? msg.life : 1;
                el.className = `log-message type-${msg.type}`;
                el.textContent = msg.text;
                el.style.opacity = opacity;
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });
    }
}