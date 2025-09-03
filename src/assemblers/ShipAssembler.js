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
import { StateComponent } from '../components/StateComponent.js';
import { PlayerControlledComponent } from '../components/PlayerControlledComponent.js';
import { AIControlledComponent } from '../components/AIControlledComponent.js';
import { AIConfigComponent } from '../components/AIConfigComponent.js';
import { CollisionComponent } from '../components/CollisionComponent.js';
import { EngineTrailComponent } from '../components/EngineTrailComponent.js';
import { HealthBarComponent } from '../components/HealthBarComponent.js';
import { StaticDataComponent } from '../components/StaticDataComponent.js';
import { MapIconComponent } from '../components/MapIconComponent.js';
import { CommandQueueComponent } from '../components/CommandQueueComponent.js';
import { ShipComponent } from '../components/ShipComponent.js';
import { PlayerStatsComponent } from '../components/PlayerStatsComponent.js';
import { PlayerInventoryComponent } from '../components/PlayerInventoryComponent.js';

// Equipment
import { Engine } from '../components/Engine.js';
import { ShieldGenerator } from '../components/ShieldGenerator.js';

const factionColors = new Map([
    ['PLAYER_FACTION', '#00ff00'],
    ['PIRATE_FACTION', '#ff0000'],
    ['CIVILIAN_FACTION', '#ffffff']
]);

const HEALTH_BAR_BASE_SCALE = 2.0;
const MIN_HEALTH_BAR_WIDTH = 6;
const MAX_HEALTH_BAR_WIDTH = 25;
const HEALTH_BAR_ASPECT_RATIO = 8.0;

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
        
        const mesh = MeshFactory.createShipMesh(shipData, this.dataManager);

        const collision = new CollisionComponent();
        const box = new THREE.Box3().setFromObject(mesh);
        box.getBoundingSphere(collision.boundingSphere);

        const healthBar = this._createHealthBar();
        const radius = collision.boundingSphere.radius;
        const finalWidth = THREE.MathUtils.clamp(
            radius * HEALTH_BAR_BASE_SCALE,
            MIN_HEALTH_BAR_WIDTH,
            MAX_HEALTH_BAR_WIDTH
        );
        const finalHeight = finalWidth / HEALTH_BAR_ASPECT_RATIO;
        healthBar.sprite.scale.set(finalWidth, finalHeight, 1);
        this.scene.add(healthBar.sprite);

        const faction = options.faction || shipData.faction;
        const mapIconColor = factionColors.get(faction) || '#ffff00';
        
        let initialCargoMass = 0;
        if (options.cargo) {
            for (const [itemId, quantity] of Object.entries(options.cargo)) {
                const itemData = this.dataManager.getItemData(itemId);
                initialCargoMass += (itemData?.mass || 0) * quantity;
            }
        }
        const cargoComponent = new CargoComponent({ 
            capacity: shipData.cargoCapacity, 
            items: options.cargo || {},
            currentMass: initialCargoMass 
        });
        
        const engine = new Engine(engineData);
        const shield = new ShieldGenerator(shieldData);

        const builder = this.ecsWorld.createEntity()
            .with(new TransformComponent({ position: options.position || new THREE.Vector3(), rotation: new THREE.Quaternion() }))
            .with(new RenderComponent(mesh))
            .with(collision)
            .with(new EngineTrailComponent())
            .with(new PhysicsComponent({ mass: shipData.baseMass, turnSpeed: shipData.turnSpeed, acceleration: engine.acceleration, maxSpeed: engine.maxSpeed, bodyType: 'dynamic' }))
            .with(new HealthComponent({ hull: options.currentHull || shipData.hull, maxHull: shipData.hull, shield: shield.capacity, maxShield: shield.capacity, shieldRegenRate: shield.regenRate }))
            .with(new EnergyComponent({ current: shipData.energy, max: shipData.energy, regenRate: shipData.energyRegen }))
            .with(new AmmoComponent(options.ammo || shipData.ammo))
            .with(cargoComponent)
            .with(new HardpointComponent(shipData.hardpoints))
            .with(new FactionComponent(faction))
            .with(new StateComponent())
            .with(new StaticDataComponent({ ...shipData, type: 'ship' }))
            .with(new MapIconComponent({ iconType: 'triangle', color: mapIconColor, isStatic: false }))
            .with(new CommandQueueComponent())
            .with(new ShipComponent())
            .with(new HealthBarComponent(healthBar));

        if (options.isPlayer) {
            builder
                .with(new PlayerControlledComponent())
                .with(new PlayerStatsComponent(options.credits))
                .with(new PlayerInventoryComponent());
        } else {
            const allBehaviors = this.dataManager.getConfig('game_balance').gameplay.ai.behaviors;
            const behaviorConfig = allBehaviors[shipData.aiBehavior] || allBehaviors['standard'];
            builder
                .with(new AIControlledComponent(shipData.aiBehavior))
                .with(new AIConfigComponent(behaviorConfig));
        }
        
        const entityId = builder.build();

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
        
        totalMass += cargo.currentMass;
        
        const massFactor = data.baseMass / totalMass;
        physics.mass = totalMass;
        physics.maxSpeed = engine.maxSpeed * massFactor;
        physics.acceleration = engine.acceleration * massFactor;
        physics.turnSpeed = data.turnSpeed * massFactor;
    }
}