// src/NotificationManager.js
const MAX_LOG_MESSAGES = 5;
const DEFAULT_MESSAGE_DURATION = 6.0;

import { eventBus } from './EventBus.js';

/**
 * Manages the data for in-game notifications. It does not handle rendering.
 */
export class NotificationManager {
    constructor() {
        this.logMessages = [];
        this.majorMessage = null;

        eventBus.on('notification', (data) => {
            this.log(data.text, data.type, data.duration);
        });
    }

    /**
     * Adds a new message to the log feed.
     * @param {string} text - The message content.
     * @param {string} type - 'info', 'success', 'warning', 'danger'. Affects styling.
     * @param {number} duration - How long the message stays on screen.
     */
    log(text, type = 'info', duration = DEFAULT_MESSAGE_DURATION) {
        if (!text) return;
        const newMessage = {
            id: Date.now() + Math.random(), // Unique ID for keying
            text,
            type,
            duration,
            life: duration, // Current time to live
        };

        this.logMessages.unshift(newMessage);

        if (this.logMessages.length > MAX_LOG_MESSAGES) {
            this.logMessages.pop();
        }
    }

    /**
     * Sets a major, screen-centering notification. (Not yet used)
     * @param {string} title 
     * @param {string} subtitle 
     */
    showMajor(title, subtitle) {
        this.majorMessage = { title, subtitle, life: 5.0 };
    }

    /**
     * Updates the lifetime of all active messages.
     * @param {number} delta - Time since the last frame.
     */
    update(delta) {
        for (let i = this.logMessages.length - 1; i >= 0; i--) {
            const msg = this.logMessages[i];
            msg.life -= delta;
            if (msg.life <= 0) {
                this.logMessages.splice(i, 1);
            }
        }

        if (this.majorMessage) {
            this.majorMessage.life -= delta;
            if (this.majorMessage.life <= 0) {
                this.majorMessage = null;
            }
        }
    }

    getLogMessages() {
        return this.logMessages;
    }

    getMajorMessage() {
        return this.majorMessage;
    }
}