// src/Ship.js
import * as THREE from 'three';
import { Engine } from './components/Engine.js';
import { ShieldGenerator } from './components/ShieldGenerator.js';
import { Weapon } from './components/Weapon.js';
import { ShipMeshFactory } from './ShipMeshFactory.js';

export class Ship {
    constructor(scene, shipData, effectsManager, dataManager) {
        this.data = shipData;
        this.id = this.data.id;
        this.isPlayer = this.data.isPlayer || false;
        this.faction = this.data.faction || 'NEUTRAL';
        this.behavior = this.data.aiBehavior;
        this.effectsManager = effectsManager;
        this.dataManager = dataManager;

        this.engine = new Engine(dataManager.getEngineData(this.data.engineSlot.equipped));
        this.shieldGenerator = new ShieldGenerator(dataManager.getShieldData(this.data.shieldSlot.equipped));
        this.hardpoints = this.data.hardpoints.map(hp => ({
            type: hp.type,
            weapon: new Weapon(dataManager.getWeaponData(hp.equipped))
        }));

        this.mesh = ShipMeshFactory.createMesh(this.data, this.dataManager);
        this.mesh.position.copy(this.data.position || new THREE.Vector3());
        this.mesh.userData.ship = this;
        scene.add(this.mesh);

        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();

        this.maxHull = this.data.hull || 100;
        this.maxShield = this.shieldGenerator.capacity;
        this.maxEnergy = this.data.energy || 100;
        this.maxCargo = this.data.cargoCapacity || 0;

        this.hull = this.data.currentHull || this.maxHull;
        this.shield = this.maxShield;
        this.energy = this.maxEnergy;
        this.cargoHold = new Map(Object.entries(this.data.cargo || {}));
        this.ammo = new Map(Object.entries(this.data.ammo || {}));
        
        this.selectedWeaponIndex = 0;
        this.velocity = new THREE.Vector3();
        this.isDestroyed = false;

        this.shieldRegenRate = this.shieldGenerator.regenRate;
        this.energyRegen = this.data.energyRegen || 5;
        
        this.currentMass = 0;
        this.actualMaxSpeed = 0;
        this.actualAcceleration = 0;
        this.actualTurnSpeed = 0;
        this.boostMultiplier = 1.0;

        this.healthBar = null;
        this.healthBarColor = '#ff0000';
        if (!this.isPlayer) {
            this.healthBar = this._createHealthBar();
            scene.add(this.healthBar.sprite);
        }
        
        this._updateMassAndPerformance();
    }

    setHealthBarColor(color) {
        this.healthBarColor = color;
    }

    _updateMassAndPerformance() {
        let totalMass = this.data.baseMass;
        
        totalMass += this.engine.mass;
        totalMass += this.shieldGenerator.mass;
        this.hardpoints.forEach(hp => totalMass += hp.weapon.mass);
        this.cargoHold.forEach((quantity, itemId) => {
            const itemData = this.dataManager.getItemData(itemId);
            totalMass += (itemData?.mass || 0) * quantity;
        });
        this.currentMass = totalMass;

        const massFactor = this.data.baseMass / this.currentMass;
        this.actualMaxSpeed = this.engine.maxSpeed * massFactor;
        this.actualAcceleration = this.engine.acceleration * massFactor;
        this.actualTurnSpeed = this.data.turnSpeed * massFactor;
    }

    accelerate(delta, maxSpeedRatio = 1.0) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        const accelerationVector = forward.multiplyScalar(this.actualAcceleration * delta);
        this.velocity.add(accelerationVector);
        
        const currentMaxSpeed = this.actualMaxSpeed * this.boostMultiplier * maxSpeedRatio;
        if (this.velocity.lengthSq() > currentMaxSpeed * currentMaxSpeed) {
            this.velocity.setLength(currentMaxSpeed);
        }
    }
    
    decelerate(delta) {
        const decelerationFactor = 1.0 - (0.7 * delta);
        this.velocity.multiplyScalar(decelerationFactor);
        if (this.velocity.lengthSq() < 0.1) {
            this.velocity.set(0, 0, 0);
        }
    }

    turnYaw(direction) { this.mesh.rotateY(this.actualTurnSpeed * direction); }
    turnPitch(direction) { this.mesh.rotateX(this.actualTurnSpeed * direction); }
    turnRoll(direction) { this.mesh.rotateZ(this.actualTurnSpeed * direction); }

    getCurrentWeapon() {
        if (this.hardpoints.length === 0 || !this.hardpoints[this.selectedWeaponIndex]) return null;
        return this.hardpoints[this.selectedWeaponIndex].weapon;
    }

    addCargo(itemId, quantity) {
        const currentCargo = Array.from(this.cargoHold.values()).reduce((sum, val) => sum + val, 0);
        const canAdd = Math.min(quantity, this.maxCargo - currentCargo);
        if (canAdd <= 0) return 0;

        const currentQuantity = this.cargoHold.get(itemId) || 0;
        this.cargoHold.set(itemId, currentQuantity + canAdd);
        this._updateMassAndPerformance();
        return canAdd;
    }

    takeDamage(amount) {
        if (this.isDestroyed) return;
        if (this.isPlayer) this.effectsManager.showPlayerDamageEffect();
        const damageDealt = Math.min(this.shield + this.hull, amount);
        this.effectsManager.showDamageNumber(this.mesh.position, Math.round(damageDealt), 0xffffff);
        
        if (this.shield > 0) {
            this.shield -= amount;
            if (this.shield < 0) { this.hull += this.shield; this.shield = 0; }
        } else {
            this.hull -= amount;
        }

        if (this.hull <= 0 && !this.isDestroyed) {
            this.isDestroyed = true;
            this.hull = 0;
            this.mesh.visible = false;
            if (this.healthBar) {
                this.healthBar.sprite.visible = false;
            }
            this.effectsManager.createExplosion(this.mesh.position);
        }
    }

    update(delta) {
        if (this.isDestroyed) return;

        this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * delta);
        this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate * delta);
        
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));
        this.boundingBox.setFromObject(this.mesh);
        this.boundingBox.getBoundingSphere(this.boundingSphere);
        
        if (this.healthBar) {
            this.healthBar.sprite.position.copy(this.mesh.position).add(new THREE.Vector3(0, 3.5, 0));
            this._updateHealthBar();
        }
    }
    
    getScreenPosition(camera) {
        const position = new THREE.Vector3();
        this.mesh.getWorldPosition(position);
        return position.project(camera);
    }

    _createHealthBar() {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 32;
        const context = canvas.getContext('2d');
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(0, 3.5, 0); sprite.scale.set(6, 0.75, 1);
        sprite.layers.set(1);

        return { sprite, canvas, context, texture };
    }

    _updateHealthBar() {
        if (!this.healthBar || this.isDestroyed) return;
        const ctx = this.healthBar.context; const canvas = this.healthBar.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = this.healthBarColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        const totalHealth = this.maxHull + this.maxShield; 
        const currentHealth = this.hull + this.shield;
        const healthPercent = totalHealth > 0 ? currentHealth / totalHealth : 0;
        
        ctx.fillStyle = this.healthBarColor;
        ctx.fillRect(4, 4, (canvas.width - 8) * healthPercent, canvas.height - 8);
        this.healthBar.texture.needsUpdate = true;
    }
}