// src/main.js
import { Game } from './Game.js';
import { DataManager } from './DataManager.js';
import { serviceLocator } from './ServiceLocator.js';

async function main() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('loading-progress-bar');

    const dataManager = new DataManager();
    serviceLocator.register('DataManager', dataManager);
    
    await dataManager.loadData((progress) => {
        progressBar.style.width = `${progress * 100}%`;
    });
    
    loadingOverlay.style.display = 'none';

    const game = new Game();
    game.start();
}

window.addEventListener('DOMContentLoaded', main);