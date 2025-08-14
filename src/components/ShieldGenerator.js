// src/components/ShieldGenerator.js
export class ShieldGenerator {
    constructor(shieldData) {
        if (!shieldData) {
            throw new Error(`Shield data is undefined.`);
        }
        // This copies all properties from the data object (capacity, regenRate, mass, etc.)
        Object.assign(this, shieldData);
    }
}