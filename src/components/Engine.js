// src/components/Engine.js
export class Engine {
    constructor(engineData) {
        if (!engineData) {
            throw new Error(`Engine data is undefined.`);
        }
        // This copies all properties from the data object (maxSpeed, acceleration, mass, etc.)
        Object.assign(this, engineData);
    }
}