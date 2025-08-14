// src/components/Weapon.js
export class Weapon {
    constructor(weaponData) {
        if (!weaponData) {
            throw new Error(`Weapon data is undefined.`);
        }
        // Copy all properties from data to this instance
        Object.assign(this, weaponData);
    }
}