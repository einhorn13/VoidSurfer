// src/ActionBuffer.js
/**
 * Manages user input intentions by tracking the state of each action.
 * This provides a robust way to handle single presses, holds, and releases.
 */
class ActionBuffer {
    constructor() {
        // A map to store the state of each action.
        // e.g., 'FIRE_WEAPON' -> { state: 'JUST_PRESSED', pressedTime: 12345 }
        this.actionStates = new Map();
    }

    /**
     * Called on keydown. Sets the action's state to JUST_PRESSED.
     * @param {string} action The action to press.
     */
    pressAction(action) {
        if (!action) return;
        const currentState = this.actionStates.get(action);
        // Prevent re-triggering if the key is held down (e.g., by OS key repeat)
        if (!currentState || (currentState.state !== 'HELD' && currentState.state !== 'JUST_PRESSED')) {
            this.actionStates.set(action, { state: 'JUST_PRESSED', pressedTime: Date.now() });
        }
    }

    /**
     * Called on keyup. Sets the action's state to JUST_RELEASED.
     * @param {string} action The action to release.
     */
    releaseAction(action) {
        if (!action) return;
        const currentState = this.actionStates.get(action);
        if (currentState) {
            this.actionStates.set(action, { ...currentState, state: 'JUST_RELEASED' });
        }
    }

    /**
     * Returns true if the action was pressed on this frame.
     * @param {string} action The action to check.
     * @returns {boolean}
     */
    isPressed(action) {
        const state = this.actionStates.get(action);
        return state?.state === 'JUST_PRESSED';
    }

    /**
     * Returns true if the action is currently held down (pressed this frame or held from previous frames).
     * @param {string} action The action to check.
     * @returns {boolean}
     */
    isDown(action) {
        const state = this.actionStates.get(action);
        return state?.state === 'JUST_PRESSED' || state?.state === 'HELD';
    }

    /**
     * Returns true if the action was released on this frame.
     * @param {string} action The action to check.
     * @returns {boolean}
     */
    isReleased(action) {
        const state = this.actionStates.get(action);
        return state?.state === 'JUST_RELEASED';
    }

    /**
     * Called at the end of each frame to update action states.
     * JUST_PRESSED becomes HELD.
     * JUST_RELEASED is removed.
     */
    update() {
        for (const [action, value] of this.actionStates.entries()) {
            if (value.state === 'JUST_PRESSED') {
                value.state = 'HELD';
            } else if (value.state === 'JUST_RELEASED') {
                this.actionStates.delete(action);
            }
        }
    }
}

export const actionBuffer = new ActionBuffer();