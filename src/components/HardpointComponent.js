// src/components/HardpointComponent.js
import { Component } from '../ecs/Component.js';
import { Weapon } from './Weapon.js';
import { serviceLocator } from '../ServiceLocator.js';

export class HardpointComponent extends Component {
    constructor(hardpointData) {
        super();
        const dataManager = serviceLocator.get('DataManager');
        // hardpointData is the array from the ship's JSON file
        this.hardpoints = hardpointData.map(hp => ({
            ...hp, // Copies type, pos
            weapon: new Weapon(dataManager.getWeaponData(hp.equipped))
        }));
        this.selectedWeaponIndex = 0;
    }
}