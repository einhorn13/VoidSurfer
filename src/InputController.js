// src/InputController.js
import { actionBuffer } from './ActionBuffer.js';
import { keybindingManager } from './KeybindingManager.js';

// This file is now only responsible for capturing raw browser events
// and passing them to the keybinding manager and action buffer.

const mouseState = {
    x: 0, // Normalized position (-1 to 1)
    y: 0  // Normalized position (-1 to 1)
};

window.addEventListener('keydown', (e) => {
    const action = keybindingManager.getActionForKey(e.key);
    actionBuffer.pressAction(action);
});

window.addEventListener('keyup', (e) => {
    const action = keybindingManager.getActionForKey(e.key);
    actionBuffer.releaseAction(action);
});

window.addEventListener('mousedown', (e) => {
    let key;
    if (e.button === 0) key = 'mouseleft';
    if (e.button === 2) key = 'mouseright';
    if (key) {
        const action = keybindingManager.getActionForKey(key);
        actionBuffer.pressAction(action);
    }
});

window.addEventListener('mouseup', (e) => {
    let key;
    if (e.button === 0) key = 'mouseleft';
    if (e.button === 2) key = 'mouseright';
    if (key) {
        const action = keybindingManager.getActionForKey(key);
        actionBuffer.releaseAction(action);
    }
});

window.addEventListener('mousemove', (e) => {
    mouseState.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseState.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

export { mouseState };