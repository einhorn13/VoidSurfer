// src/components/HardpointComponent.js
import { Component } from '../ecs/Component.js';
import { Weapon } from './Weapon.js';
import { serviceLocator } from '../ServiceLocator.js';

export class HardpointComponent extends Component {
    constructor(hardpointData) {
        super();
        const dataManager = serviceLocator.get('DataManager');
        this.hardpoints = hardpointData.map(hp => ({
            ...hp,
            weapon: new Weapon(dataManager.getWeaponData(hp.equipped)),
            cooldownLeft: 0, // Individual Weapon Cooldown (WCD)
        }));
        this.selectedWeaponIndex = 0;
    }
}