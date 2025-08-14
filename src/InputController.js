// src/InputController.js
const keyState = {
    mouseLeft: false
};

const mouseState = {
    x: 0, // Normalized position (-1 to 1)
    y: 0  // Normalized position (-1 to 1)
};

window.addEventListener('keydown', (e) => { keyState[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', (e) => { keyState[e.key.toLowerCase()] = false; });
window.addEventListener('mousedown', (e) => { if (e.button === 0) keyState.mouseLeft = true; });
window.addEventListener('mouseup', (e) => { if (e.button === 0) keyState.mouseLeft = false; });

window.addEventListener('mousemove', (e) => {
    mouseState.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseState.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

export { keyState, mouseState };