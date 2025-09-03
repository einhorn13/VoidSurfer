// src/EntityAssembler.js
import { ShipAssembler } from './assemblers/ShipAssembler.js';
import { MissileAssembler } from './assemblers/MissileAssembler.js';
import { ProjectileAssembler } from './assemblers/ProjectileAssembler.js';
import { EnvironmentAssembler } from './assemblers/EnvironmentAssembler.js';
import { EffectAssembler } from './assemblers/EffectAssembler.js';
import { ItemAssembler } from './assemblers/ItemAssembler.js';

/**
 * A Facade for all specialized entity assemblers.
 * This is the single point of contact for entity creation in the game.
 * It is registered with the ServiceLocator as 'EntityFactory' to maintain API compatibility.
 */
export class EntityAssembler {
    constructor() {
        this.ship = new ShipAssembler();
        this.missile = new MissileAssembler();
        this.projectile = new ProjectileAssembler();
        this.environment = new EnvironmentAssembler();
        this.effect = new EffectAssembler();
        this.item = new ItemAssembler();
    }

    init() {
        this.projectile.init();
        this.effect.init(); // Initialize damage number pool
    }

    // Ship
    createShip(shipId, options) { return this.ship.createShip(shipId, options); }
    updateMassAndPerformance(entityId) { this.ship.updateMassAndPerformance(entityId); }

    // Projectiles
    createMissile(originId, hardpoint, targetId) { return this.missile.createMissile(originId, hardpoint, targetId); }
    createPlasmaBolt(originId, hardpoint) { return this.projectile.getProjectile(originId, hardpoint); }
    
    // Environment
    createStation(position) { return this.environment.createStation(position); }
    createPlanet(data) { return this.environment.createPlanet(data); }
    createSun(data) { return this.environment.createSun(data); }
    
    // Effect
    createExplosion(position) { return this.effect.createExplosion(position); }
    createHullDebris(pos, norm, vel, col) { return this.effect.createHullDebris(pos, norm, vel, col); }
    createLaserBeam(start, end, color) { return this.effect.createLaserBeam(start, end, color); }
    spawnDamageNumber(position, amount) { return this.effect.getDamageNumber(position, amount); }
    releaseDamageNumber(entityId) { this.effect.releaseDamageNumber(entityId); }


    // Item & Salvage
    createItem(itemId, quantity, position) { return this.item.createItem(itemId, quantity, position); }
    createSalvageContainer(contents, position) { return this.item.createSalvageContainer(contents, position); }
}