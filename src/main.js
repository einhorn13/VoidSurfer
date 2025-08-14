// src/main.js
import { Game } from './Game.js';
import { DataManager } from './DataManager.js';

async function main() {
    // Show a simple loading message
    document.body.innerHTML = '<h1 style="color: #0f0; text-align: center; margin-top: 20%;">Loading Assets...</h1>';

    const dataManager = new DataManager();
    await dataManager.loadData();
    
    // Clear loading message and start the game
    document.body.innerHTML = ''; 
    const game = new Game(dataManager);
    game.start();
}

window.addEventListener('DOMContentLoaded', main);