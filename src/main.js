// src/main.js
import { Application } from './Application.js';

// Self-invoking async function to create a private scope and handle async operations
(async function main() {
    try {
        const app = new Application();
        await app.init();
        app.start();
    } catch (error) {
        console.error("Halting application initialization due to a critical error:", error);
        // A loading manager (if used inside Application) or a simple DOM element could display this error to the user.
    }
})();