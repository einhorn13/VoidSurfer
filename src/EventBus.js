/**
 * A simple singleton event emitter for decoupled communication between modules.
 */
class EventBus {
    constructor() {
        this.events = new Map();
    }

    /**
     * Subscribes to an event.
     * @param {string} eventName The name of the event.
     * @param {function} callback The function to execute when the event is emitted.
     * @returns {function} A function to unsubscribe.
     */
    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        this.events.get(eventName).push(callback);

        // Return an unsubscribe function
        return () => this.off(eventName, callback);
    }

    /**
     * Unsubscribes from an event.
     * @param {string} eventName The name of the event.
     * @param {function} callback The callback to remove.
     */
    off(eventName, callback) {
        if (this.events.has(eventName)) {
            const callbacks = this.events.get(eventName);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emits an event, calling all subscribed callbacks.
     * @param {string} eventName The name of the event to emit.
     * @param {*} data The data to pass to the callbacks.
     */
    emit(eventName, data) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event handler for "${eventName}":`, error);
                }
            });
        }
    }
}

// Export a single instance for the entire application
export const eventBus = new EventBus();