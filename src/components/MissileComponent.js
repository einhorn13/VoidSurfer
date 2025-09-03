import { Component } from '../ecs/Component.js';

export class MissileComponent extends Component {
    constructor({ damage, faction, originId, weaponData }) {
        super();
        this.damage = damage;
        this.faction = faction;
        this.originId = originId;
        this.weaponData = weaponData;
    }
}