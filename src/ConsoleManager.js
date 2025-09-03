import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';

export class ConsoleManager {
    constructor() {
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.isOpen = false;

        this.container = document.getElementById('console-container');
        this.output = document.getElementById('console-output');
        this.input = document.getElementById('console-input');

        this.commandHandlers = new Map();
        this.commandDescriptions = new Map();
        this.history = [];
        this.historyIndex = -1;
        this.cachedSystems = new Map();

        this._registerCommands();
        this._addEventListeners();
        
        this.log('Console initialized. Type "help" for a list of commands.');
    }

    _addEventListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '`') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this.isOpen) {
                e.preventDefault();
                this.hide();
            }
        });

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._executeCommand(this.input.value);
                this.input.value = '';
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });

        eventBus.on('debug_damage_event', (data) => this.handleDebugDamageEvent(data));
    }

    _registerCommand(name, description, handler) {
        this.commandHandlers.set(name, handler);
        this.commandDescriptions.set(name, description);
    }
    
    _getSystem(systemName) {
        if (this.cachedSystems.has(systemName)) {
            return this.cachedSystems.get(systemName);
        }
        const system = this.ecsWorld.systems.find(sys => sys.constructor.name === systemName);
        if (system) {
            this.cachedSystems.set(systemName, system);
        }
        return system;
    }

    _registerCommands() {
        this._registerCommand('help', 'Lists all available commands.', () => {
            this.log('Available commands:');
            this.commandDescriptions.forEach((desc, name) => {
                this.log(`- ${name}: ${desc}`, '#0ff');
            });
        });

        this._registerCommand('addcredits', 'Adds credits. Usage: addcredits <amount>', (args) => {
            const amount = parseInt(args[0], 10);
            if (isNaN(amount)) {
                return this.log('Error: Invalid amount.', 'red');
            }
            const playerIds = this.ecsWorld.query(['PlayerStatsComponent']);
            if (playerIds.length > 0) {
                const stats = this.ecsWorld.getComponent(playerIds[0], 'PlayerStatsComponent');
                stats.credits += amount;
                this.log(`Added ${amount} credits. Total: ${stats.credits}`, 'yellow');
                eventBus.emit('player_stats_updated');
            } else {
                this.log('Error: Player stats not found.', 'red');
            }
        });

        this._registerCommand('spawn', 'Spawns a ship. Usage: spawn <shipId> [count=1] [faction]', (args) => {
            const [shipId, countStr = '1', faction] = args;
            const count = parseInt(countStr, 10);
            if (!shipId) return this.log('Error: Ship ID is required.', 'red');
            
            const dataManager = serviceLocator.get('DataManager');
            if (!dataManager.getShipData(shipId.toUpperCase())) {
                return this.log(`Error: Ship with ID "${shipId.toUpperCase()}" not found.`, 'red');
            }
            if (isNaN(count)) return this.log('Error: Invalid count.', 'red');

            const playerIds = this.ecsWorld.query(['PlayerControlledComponent']);
            if (playerIds.length === 0) return this.log('Error: Player not found.', 'red');
            
            const playerTransform = this.ecsWorld.getComponent(playerIds[0], 'TransformComponent');
            const gameDirector = serviceLocator.get('GameDirector');

            const spawnOptions = {
                objective: { type: 'HUNT_PLAYER' }
            };
            if (faction) {
                const upperFaction = faction.toUpperCase();
                if (!upperFaction.endsWith('_FACTION')) {
                     return this.log(`Error: Invalid faction format. Must end with '_FACTION'.`, 'red');
                }
                spawnOptions.faction = upperFaction;
            }

            for (let i = 0; i < count; i++) {
                const offset = new THREE.Vector3((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, -150 - (Math.random() * 100));
                const spawnPos = playerTransform.position.clone().add(offset);
                gameDirector.spawnNewNpc(shipId.toUpperCase(), spawnPos, spawnOptions.objective, spawnOptions.faction);
            }
            this.log(`Spawned ${count} of ${shipId.toUpperCase()}${faction ? ` for faction ${faction.toUpperCase()}` : ''}.`, 'yellow');
        });
        
        this._registerCommand('killall', 'Destroys all non-player ships.', () => {
            let count = 0;
            const shipIds = this.ecsWorld.query(['ShipComponent']);
            shipIds.forEach(id => {
                if (this.ecsWorld.getComponent(id, 'PlayerControlledComponent')) return;
                const health = this.ecsWorld.getComponent(id, 'HealthComponent');
                if (health && health.state === 'ALIVE') {
                    health.state = 'DESTROYED';
                    count++;
                }
            });
            this.log(`Destroyed ${count} ships.`, 'yellow');
        });

        this._registerCommand('arcade', 'Toggles arcade mode. Usage: arcade <on|off>', (args) => {
            const setting = args[0]?.toLowerCase();
            if (setting === 'on') {
                this.gameStateManager.setArcadeMode(true);
            } else if (setting === 'off') {
                this.gameStateManager.setArcadeMode(false);
            } else if (!setting) {
                this.log(`Arcade Mode is currently: ${this.gameStateManager.isArcadeMode() ? 'ON' : 'OFF'}`);
            } else {
                this.log('Error: Invalid argument. Use "on" or "off".', 'red');
            }
        });

        this._registerCommand('debug', 'Toggles debug visualizations. Usage: debug <on|off>', (args) => {
            const debugSystem = this._getSystem('DebugSystem');
            if (!debugSystem) return this.log('Error: DebugSystem not found.', 'red');

            const setting = args[0]?.toLowerCase();
            if (setting === 'on') {
                debugSystem.toggle(true);
                this.log(`Collision debug visualization is now ON.`, 'yellow');
            } else if (setting === 'off') {
                debugSystem.toggle(false);
                this.log(`Collision debug visualization is now OFF.`, 'yellow');
            } else if (!setting) {
                this.log(`Collision debug visualization is currently: ${debugSystem.isEnabled ? 'ON' : 'OFF'}`);
            } else {
                this.log('Error: Invalid argument. Use "on" or "off".', 'red');
            }
        });
    }

    _executeCommand(inputText) {
        if (!inputText) return;
        this.log(`> ${inputText}`, '#0f0');

        if (inputText !== this.history[this.history.length - 1]) {
            this.history.push(inputText);
        }
        this.historyIndex = this.history.length;

        const parts = inputText.trim().split(/\s+/);
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        const handler = this.commandHandlers.get(commandName);
        if (handler) {
            try {
                handler(args);
            } catch (error) {
                this.log(`Error executing command: ${error.message}`, 'red');
                console.error(error);
            }
        } else {
            this.log(`Unknown command: "${commandName}"`, 'red');
        }
    }
    
    navigateHistory(direction) {
        if (this.history.length === 0) return;

        this.historyIndex = Math.max(-1, Math.min(this.history.length, this.historyIndex + direction));

        if (this.historyIndex >= this.history.length || this.historyIndex === -1) {
            this.input.value = '';
        } else {
            this.input.value = this.history[this.historyIndex];
        }
    }

    handleDebugDamageEvent(data) {
        const debugSystem = this._getSystem('DebugSystem');
        if (!debugSystem || !debugSystem.isEnabled) return;

        const getEntityName = (id) => {
            if (id === undefined || id === null) return 'the environment';
            return this.ecsWorld.getComponent(id, 'StaticDataComponent')?.data.name || `Entity ${id}`;
        };

        const attackerName = getEntityName(data.attackerId);
        const targetName = getEntityName(data.targetId);
        const weaponName = data.weaponData?.name || 'Collision';
        const damageAmount = Math.round(data.amount);

        if (damageAmount > 0) {
            this.log(`[DMG] ${attackerName} -> ${targetName} for ${damageAmount} with ${weaponName}`, '#ff8c00');
        }
    }

    log(message, color = '#eee') {
        const li = document.createElement('li');
        li.textContent = message;
        li.style.color = color;
        this.output.appendChild(li);
        this.output.scrollTop = this.output.scrollHeight;
    }

    show() {
        this.isOpen = true;
        this.container.style.display = 'flex';
        this.input.focus();
        this.gameStateManager.setConsoleOpen(true);
    }

    hide() {
        this.isOpen = false;
        this.container.style.display = 'none';
        this.input.blur();
        this.gameStateManager.setConsoleOpen(false);
    }

    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }
}