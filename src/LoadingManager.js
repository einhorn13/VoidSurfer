/**
 * Manages the loading process and updates the loading UI.
 */
export class LoadingManager {
    constructor() {
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.progressBar = document.getElementById('loading-progress-bar');
        this.loadingText = this.loadingOverlay.querySelector('h1');
    }

    /**
     * Simulates loading external libraries from importmap.
     */
    async loadLibs() {
        this.loadingText.textContent = 'Loading Libraries...';
        
        // We can't actually track importmap progress, so we simulate it.
        // This gives the user feedback while the browser downloads Three.js.
        const simulationDuration = 400; // 0.4 seconds
        let progress = 0;
        const interval = setInterval(() => {
            progress += 0.05;
            this.updateProgress(progress * 0.5); // Fill up to 50%
            if (progress >= 1) {
                clearInterval(interval);
            }
        }, simulationDuration / 20);

        return new Promise(resolve => setTimeout(resolve, simulationDuration));
    }

    /**
     * Loads game data assets and updates the progress bar from 50% to 100%.
     * @param {import('./DataManager.js').DataManager} dataManager - The data manager to load.
     */
    async loadData(dataManager) {
        this.loadingText.textContent = 'Loading Assets...';
        try {
            await dataManager.loadData((progress) => {
                // Map asset progress (0-1) to the remaining 50% of the bar
                this.updateProgress(0.5 + progress * 0.5);
            });
            this.hide();
        } catch (error) {
            console.error("Failed to load game data:", error);
            this.showError("Failed to load game assets. Please check the console and refresh.");
            throw error; // Halt game execution
        }
    }

    updateProgress(progress) {
        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(progress * 100, 100)}%`;
        }
    }

    showError(message) {
        if (this.loadingText) {
            this.loadingText.textContent = `Error: ${message}`;
            this.loadingText.style.color = 'red';
        }
        if (this.progressBar) {
            this.progressBar.parentElement.style.display = 'none';
        }
    }

    hide() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }
}