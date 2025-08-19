
/**
 * A simple service locator for managing global manager instances.
 * This helps to avoid tight coupling and long constructor argument lists.
 */
class ServiceLocator {
    constructor() {
        this.services = new Map();
    }

    /**
     * Registers a service instance.
     * @param {string} name The name of the service (e.g., 'WorldManager').
     * @param {*} service The service instance.
     */
    register(name, service) {
        if (this.services.has(name)) {
            console.warn(`Service "${name}" is already registered. Overwriting.`);
        }
        this.services.set(name, service);
    }

    /**
     * Retrieves a service instance.
     * @param {string} name The name of the service.
     * @returns {*} The service instance.
     */
    get(name) {
        if (!this.services.has(name)) {
            throw new Error(`Service "${name}" not found.`);
        }
        return this.services.get(name);
    }
}

// Export a single instance for the entire application
export const serviceLocator = new ServiceLocator();