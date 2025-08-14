// src/ConsoleManager.js
import * as THREE from 'three';

export class ConsoleManager {
    constructor(gameStateManager, worldManager) {
        this.gameStateManager = gameStateManager;
        this.worldManager = worldManager;
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
                const playerPos = this.worldManager.playerShip.mesh.position;
                for (let i = 0; i < count; i++) {
                    const offset = new THREE.Vector3(
                        (Math.random() - 0.5) * 200,
                        (Math.random() - 0.5) * 200,
                        -150 - (Math.random() * 100)
                    );
                    const spawnPos = playerPos.clone().add(offset);
                    this.worldManager.createShip(shipId, { position: spawnPos, faction: 'PIRATE_FACTION' });
                }
                this.log(`Spawned ${count} of ${shipId}.`, 'yellow');
            }
        });
        
        this.commands.set('killall', {
            description: 'Destroys all non-player ships.',
            handler: () => {
                let count = 0;
                this.worldManager.allShips.forEach(ship => {
                    if (!ship.isPlayer && !ship.isDestroyed) {
                        ship.takeDamage(ship.hull + ship.shield + 1);
                        count++;
                    }
                });
                this.log(`Destroyed ${count} ships.`, 'yellow');
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