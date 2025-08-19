// src/ConsoleManager.js
import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';

export class ConsoleManager {
    constructor() {
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.worldManager = serviceLocator.get('WorldManager');
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.isOpen = false;

        this.container = document.getElementById('console-container');
        this.output = document.getElementById('console-output');
        this.input = document.getElementById('console-input');

        this.commands = new Map();
        this._registerCommands();
        this._addEventListeners();
        
        this.log('Console initialized. Type "help" for a list of commands.');
    }

    _addEventListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '`') { // Tilde key
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
            }
        });
    }

    _registerCommands() {
        this.commands.set('help', {
            description: 'Lists all available commands.',
            handler: () => {
                this.log('Available commands:');
                this.commands.forEach((cmd, name) => {
                    this.log(`- ${name}: ${cmd.description}`, '#0ff');
                });
            }
        });

        this.commands.set('addcredits', {
            description: 'Adds credits. Usage: addcredits <amount>',
            handler: (args) => {
                const amount = parseInt(args[0], 10);
                if (isNaN(amount)) {
                    this.log('Error: Invalid amount.', 'red');
                    return;
                }
                this.gameStateManager.addCredits(amount);
                this.log(`Added ${amount} credits. Total: ${this.gameStateManager.playerState.credits}`, 'yellow');
            }
        });

        this.commands.set('spawn', {
            description: 'Spawns a ship. Usage: spawn <shipId> [count=1]',
            handler: (args) => {
                const [shipId, countStr = '1'] = args;
                const count = parseInt(countStr, 10);
                if (!shipId) {
                    this.log('Error: Ship ID is required.', 'red');
                    return;
                }
                const playerIds = this.ecsWorld.query(['PlayerControlledComponent']);
                if (playerIds.length === 0) {
                    this.log('Error: Player not found.', 'red');
                    return;
                }
                const playerTransform = this.ecsWorld.getComponent(playerIds[0], 'TransformComponent');

                for (let i = 0; i < count; i++) {
                    const offset = new THREE.Vector3(
                        (Math.random() - 0.5) * 200,
                        (Math.random() - 0.5) * 200,
                        -150 - (Math.random() * 100)
                    );
                    const spawnPos = playerTransform.position.clone().add(offset);
                    serviceLocator.get('GameDirector').createShip(shipId.toUpperCase(), { position: spawnPos, faction: 'PIRATE_FACTION' });
                }
                this.log(`Spawned ${count} of ${shipId}.`, 'yellow');
            }
        });
        
        this.commands.set('killall', {
            description: 'Destroys all non-player ships.',
            handler: () => {
                let count = 0;
                const shipIds = this.ecsWorld.query(['ShipTag']);
                shipIds.forEach(id => {
                    if (this.ecsWorld.getComponent(id, 'PlayerControlledComponent')) return;
                    
                    const health = this.ecsWorld.getComponent(id, 'HealthComponent');
                    if (health && !health.isDestroyed) {
                        health.isDestroyed = true;
                        count++;
                    }
                });
                this.log(`Destroyed ${count} ships.`, 'yellow');
            }
        });

        this.commands.set('arcade', {
            description: 'Toggles arcade mode. Usage: arcade <on|off>',
            handler: (args) => {
                const setting = args[0]?.toLowerCase();
                if (setting === 'on') {
                    this.gameStateManager.setArcadeMode(true);
                } else if (setting === 'off') {
                    this.gameStateManager.setArcadeMode(false);
                } else if (!setting) {
                    const currentState = this.gameStateManager.isArcadeMode() ? 'ON' : 'OFF';
                    this.log(`Arcade Mode is currently: ${currentState}`);
                } else {
                    this.log('Error: Invalid argument. Use "on" or "off".', 'red');
                }
            }
        });

        this.commands.set('debug', {
            description: 'Toggles debug visualizations. Usage: debug <on|off>',
            handler: (args) => {
                const debugSystem = this.ecsWorld.systems.find(sys => sys.constructor.name === 'DebugSystem');
                if (!debugSystem) {
                    this.log('Error: DebugSystem not found.', 'red');
                    return;
                }
                const setting = args[0]?.toLowerCase();
                
                if (setting === 'on') {
                    debugSystem.toggle(true);
                    this.log(`Collision debug visualization is now ON.`, 'yellow');
                } else if (setting === 'off') {
                    debugSystem.toggle(false);
                    this.log(`Collision debug visualization is now OFF.`, 'yellow');
                } else if (!setting) {
                    const currentState = debugSystem.isEnabled ? 'ON' : 'OFF';
                    this.log(`Collision debug visualization is currently: ${currentState}`);
                } else {
                    this.log('Error: Invalid argument. Use "on" or "off".', 'red');
                }
            }
        });
    }

    _executeCommand(inputText) {
        if (!inputText) return;
        this.log(`> ${inputText}`, '#0f0');

        const parts = inputText.trim().split(/\s+/);
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        if (this.commands.has(commandName)) {
            try {
                this.commands.get(commandName).handler(args);
            } catch (error) {
                this.log(`Error executing command: ${error.message}`, 'red');
                console.error(error);
            }
        } else {
            this.log(`Unknown command: "${commandName}"`, 'red');
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