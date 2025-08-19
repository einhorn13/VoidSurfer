// src/assemblers/ShipAssembler.js
import * as THREE from 'three';
import { BaseAssembler } from './BaseAssembler.js';
import { MeshFactory } from '../MeshFactory.js';

// Components
import { TransformComponent } from '../components/TransformComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { EnergyComponent } from '../components/EnergyComponent.js';
import { AmmoComponent } from '../components/AmmoComponent.js';
import { CargoComponent } from '../components/CargoComponent.js';
import { HardpointComponent } from '../components/HardpointComponent.js';
import { FactionComponent } from '../components/FactionComponent.js';
import { ShipTag } from '../components/ShipTag.js';
import { PlayerControlledComponent } from '../components/PlayerControlledComponent.js';
import { AIControlledComponent } from '../components/AIControlledComponent.js';
import { CollisionComponent } from '../components/CollisionComponent.js';
import { EngineTrailComponent } from '../components/EngineTrailComponent.js';
import { HealthBarComponent } from '../components/HealthBarComponent.js';
import { StaticDataComponent } from '../components/StaticDataComponent.js';

// Equipment
import { Engine } from '../components/Engine.js';
import { ShieldGenerator } from '../components/ShieldGenerator.js';

export class ShipAssembler extends BaseAssembler {
    createShip(shipId, options = {}) {
        const shipData = this.dataManager.getShipData(shipId);
        if (!shipData) {
            console.error(`ShipAssembler: Ship data not found for ID ${shipId}`);
            return null;
        }

        const engineData = this.dataManager.getEngineData(shipData.engineSlot.equipped);
        if (!engineData) {
            console.error(`ShipAssembler: Engine data not found for ID "${shipData.engineSlot.equipped}" on ship "${shipId}"`);
            return null;
        }

        const shieldData = this.dataManager.getShieldData(shipData.shieldSlot.equipped);
        if (!shieldData) {
            console.error(`ShipAssembler: Shield data not found for ID "${shipData.shieldSlot.equipped}" on ship "${shipId}"`);
            return null;
        }

        const entityId = this.ecsWorld.createEntity();
        
        const healthBar = this._createHealthBar();
        this.scene.add(healthBar.sprite);
        this.ecsWorld.addComponent(entityId, new HealthBarComponent(healthBar));

        const mesh = MeshFactory.createShipMesh(shipData, this.dataManager);

        // FIX: Calculate the bounding sphere ONCE, correctly.
        const collision = new CollisionComponent();
        const box = new THREE.Box3().setFromObject(mesh);
        box.getBoundingSphere(collision.boundingSphere);
        // We now have a sphere with a correct, tight-fitting radius.

        this.ecsWorld.addComponent(entityId, new TransformComponent({ position: options.position || new THREE.Vector3(), rotation: new THREE.Quaternion() }));
        this.ecsWorld.addComponent(entityId, new RenderComponent(mesh));
        this.ecsWorld.addComponent(entityId, collision); // Add the component with the pre-calculated sphere
        this.ecsWorld.addComponent(entityId, new EngineTrailComponent());
        const engine = new Engine(engineData);
        const shield = new ShieldGenerator(shieldData);
        this.ecsWorld.addComponent(entityId, new PhysicsComponent({ mass: shipData.baseMass, turnSpeed: shipData.turnSpeed, acceleration: engine.acceleration, maxSpeed: engine.maxSpeed, bodyType: 'dynamic' }));
        this.ecsWorld.addComponent(entityId, new HealthComponent({ hull: options.currentHull || shipData.hull, maxHull: shipData.hull, shield: shield.capacity, maxShield: shield.capacity, shieldRegenRate: shield.regenRate }));
        this.ecsWorld.addComponent(entityId, new EnergyComponent({ current: shipData.energy, max: shipData.energy, regenRate: shipData.energyRegen }));
        this.ecsWorld.addComponent(entityId, new AmmoComponent(options.ammo || shipData.ammo));
        this.ecsWorld.addComponent(entityId, new CargoComponent({ capacity: shipData.cargoCapacity, items: options.cargo || {} }));
        this.ecsWorld.addComponent(entityId, new HardpointComponent(shipData.hardpoints));
        this.ecsWorld.addComponent(entityId, new FactionComponent(options.faction || shipData.faction));
        this.ecsWorld.addComponent(entityId, new ShipTag());
        this.ecsWorld.addComponent(entityId, new StaticDataComponent({ ...shipData, type: 'ship' }));
        if (options.isPlayer) { this.ecsWorld.addComponent(entityId, new PlayerControlledComponent()); } else { this.ecsWorld.addComponent(entityId, new AIControlledComponent(shipData.aiBehavior)); }

        mesh.userData.entityId = entityId;
        this.scene.add(mesh);
        this.updateMassAndPerformance(entityId);
        return entityId;
    }

    _createHealthBar() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 16;
        const context = canvas.getContext('2d');
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(10, 1.25, 1);
        sprite.visible = false;
        return { sprite, canvas, context };
    }

    updateMassAndPerformance(entityId) {
        const physics = this.ecsWorld.getComponent(entityId, 'PhysicsComponent');
        const hardpoints = this.ecsWorld.getComponent(entityId, 'HardpointComponent');
        const cargo = this.ecsWorld.getComponent(entityId, 'CargoComponent');
        const staticData = this.ecsWorld.getComponent(entityId, 'StaticDataComponent');
        if (!physics || !hardpoints || !cargo || !staticData) return;

        const data = staticData.data;
        const engine = new Engine(this.dataManager.getEngineData(data.engineSlot.equipped));
        const shield = new ShieldGenerator(this.dataManager.getShieldData(data.shieldSlot.equipped));

        let totalMass = data.baseMass + engine.mass + shield.mass;
        hardpoints.hardpoints.forEach(hp => totalMass += hp.weapon.mass);
        cargo.items.forEach((quantity, itemId) => {
            totalMass += (this.dataManager.getItemData(itemId)?.mass || 0) * quantity;
        });
        
        const massFactor = data.baseMass / totalMass;
        physics.mass = totalMass;
        physics.maxSpeed = engine.maxSpeed * massFactor;
        physics.acceleration = engine.acceleration * massFactor;
        physics.turnSpeed = data.turnSpeed * massFactor;
    }
}