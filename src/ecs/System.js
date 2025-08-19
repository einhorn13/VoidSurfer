// src/ecs/System.js
export class System {
    constructor(world) {
        this.world = world;
    }

    update(delta) {
        throw new Error('System.update() must be implemented by subclass');
    }
}