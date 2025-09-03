// src/systems/WeaponFireSystem.js
import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

const laserSpreadVector = new THREE.Vector3();

export class WeaponFireSystem extends System {
    constructor(world) {
        super(world);
        this.entityFactory = serviceLocator.get('EntityFactory');
        this.dataManager = serviceLocator.get('DataManager');
        this.eventBus = serviceLocator.get('eventBus');
        this.navigationService = serviceLocator.get('NavigationService');
        this.raycaster = new THREE.Raycaster();
        this.targetableEntityIds = [];
        this.missileErrorCooldown = 0;
        
        const gameBalance = this.dataManager.getConfig('game_balance');
        this.weaponBalance = gameBalance.gameplay.weapons;
        this.laserMaxRange = this.weaponBalance.laserMaxRange || 1000; // Load laser range
        this.factionRelations = gameBalance.factionRelations;
    }

    update(delta) {
        this.missileErrorCooldown = Math.max(0, this.missileErrorCooldown - delta);
        const fireRequests = this.world.getEvents('fire_weapon_request');
        if (fireRequests.length === 0) return;

        this.targetableEntityIds = this.world.query(['HealthComponent', 'CollisionComponent', 'StaticDataComponent']);

        for (const request of fireRequests) {
            this._handleFireRequest(request);
        }
    }
    
    _handleFireRequest(request) {
        const { originId, hardpointIndex } = request;

        const hardpoints = this.world.getComponent(originId, 'HardpointComponent');
        if (!hardpoints) return;
        
        const hp = hardpoints.hardpoints[hardpointIndex];
        if (!hp || hp.cooldownLeft > 0) return;

        const weapon = hp.weapon;
        const energy = this.world.getComponent(originId, 'EnergyComponent');
        if (energy.current < weapon.energyCost) return;

        const ammo = this.world.getComponent(originId, 'AmmoComponent');
        if (weapon.ammoType && (ammo.ammo.get(weapon.ammoType) || 0) < weapon.ammoCost) {
             if (!!this.world.getComponent(originId, 'PlayerControlledComponent')) {
                const ammoData = this.dataManager.getMiscData('AMMO_DATA')[weapon.ammoType];
                const ammoName = ammoData ? ammoData.name : weapon.ammoType;
                this.eventBus.emit('notification', { text: `Out of ${ammoName}`, type: 'warning' });
            }
            return;
        }

        const isPlayer = !!this.world.getComponent(originId, 'PlayerControlledComponent');
        const stateComp = this.world.getComponent(originId, 'StateComponent');
        if (isPlayer && stateComp && stateComp.states.has('GLOBAL_COOLDOWN')) return;
        
        const aiControl = this.world.getComponent(originId, 'AIControlledComponent');
        if (aiControl) {
            const missileCooldown = aiControl.blackboard.missileCooldownLeft || 0;
            if (weapon.category === 'HEAVY' && missileCooldown > 0) {
                return;
            }
        }
        
        const fired = this._executeFire(originId, hp);
        
        if (fired) {
            hp.cooldownLeft = weapon.fireRate;
            energy.current -= weapon.energyCost;
            if (weapon.ammoType) {
                ammo.ammo.set(weapon.ammoType, ammo.ammo.get(weapon.ammoType) - weapon.ammoCost);
            }
            if (aiControl && weapon.category === 'HEAVY') {
                 const aiConfig = this.world.getComponent(originId, 'AIConfigComponent').config;
                 aiControl.blackboard.missileCooldownLeft = aiConfig.missileCooldown;
            }
        }
    }
    
    _executeFire(originId, hardpoint) {
        if (hardpoint.weapon.hitScan) {
            this._handleHitScanFire(originId, hardpoint);
            return true;
        } else {
            return this._handleProjectileFire(originId, hardpoint);
        }
    }

    _handleProjectileFire(originId, hardpoint) {
        const weaponType = hardpoint.weapon.type;

        if (weaponType === 'PROJECTILE') {
            this.entityFactory.createPlasmaBolt(originId, hardpoint);
            return true;
        } 
        
        if (weaponType === 'HOMING') {
            const playerControl = this.world.getComponent(originId, 'PlayerControlledComponent');
            let targetId = null;

            if (playerControl) {
                const navTarget = this.navigationService.getTarget();
                const fail = (message) => {
                    if (this.missileErrorCooldown === 0) {
                        this.eventBus.emit('notification', { text: message, type: 'warning' });
                        this.missileErrorCooldown = 2.0;
                    }
                    return false;
                };

                if (!navTarget || navTarget.type !== 'entity') return fail('Invalid missile target');
                targetId = navTarget.entityId;

                const targetStatic = this.world.getComponent(targetId, 'StaticDataComponent');
                if (targetStatic?.data.type !== 'ship') return fail('Missiles can only target ships');

                const originFactionComp = this.world.getComponent(originId, 'FactionComponent');
                const targetFactionComp = this.world.getComponent(targetId, 'FactionComponent');
                if (!originFactionComp || !targetFactionComp) return false;
                
                const hostileFactions = this.factionRelations[originFactionComp.name] || [];
                if (!hostileFactions.includes(targetFactionComp.name)) return fail('Cannot fire on non-hostile target');

                const originTransform = this.world.getComponent(originId, 'TransformComponent');
                const targetTransform = this.world.getComponent(targetId, 'TransformComponent');
                if (!originTransform || !targetTransform) return false;

                const distance = originTransform.position.distanceTo(targetTransform.position);
                const minRange = this.weaponBalance.missileMinRange;
                const maxRange = this.weaponBalance.missileMaxRange;
                if (distance < minRange || distance > maxRange) return fail(`Target out of missile range (${minRange}-${maxRange}m)`);

            } else { // AI Firing
                const aiControl = this.world.getComponent(originId, 'AIControlledComponent');
                if (aiControl) {
                    targetId = aiControl.blackboard.targetId;
                }
            }
            
            if (targetId !== null) {
                this.entityFactory.missile.createMissile(originId, hardpoint, targetId);
                return true;
            }
        }
        return false;
    }

    _handleHitScanFire(originId, hardpoint) {
        const weapon = hardpoint.weapon;
        const originTransform = this.world.getComponent(originId, 'TransformComponent');
        if (!originTransform) return;

        const startPoint = this._getHardpointWorldPosition(originTransform, hardpoint);
        const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(originTransform.rotation);
        
        // The "cheater" AI aiming logic that ignored ship rotation has been removed.
        // The raycast now correctly uses the ship's actual forward direction.

        const hitResult = this._performRaycast(startPoint, direction, originId);

        let endPoint;
        if (hitResult) {
            endPoint = hitResult.point;
            const hitSource = {
                weaponData: weapon,
                originId: originId,
                faction: this.world.getComponent(originId, 'FactionComponent')?.name
            };
            this.world.publish('hit', {
                sourceData: hitSource,
                targetId: hitResult.entityId,
                impactPoint: endPoint
            });
        } else {
            endPoint = startPoint.clone().add(direction.multiplyScalar(this.laserMaxRange));
        }
        
        this.entityFactory.effect.createLaserBeam(startPoint, endPoint, parseInt(weapon.color, 16));
    }

    _performRaycast(startPoint, direction, originId) {
        this.raycaster.set(startPoint, direction);
        this.raycaster.far = this.laserMaxRange; // Apply range limit to raycast

        let closestHit = null;
        const intersectionPoint = new THREE.Vector3();

        for (const targetId of this.targetableEntityIds) {
            if (targetId === originId) continue;
            
            const staticData = this.world.getComponent(targetId, 'StaticDataComponent');
            const targetType = staticData?.data.type;
            const validTypes = ['ship', 'asteroid', 'station', 'salvage', 'item'];
            if (!validTypes.includes(targetType)) {
                continue;
            }

            const health = this.world.getComponent(targetId, 'HealthComponent');
            if (health && health.state !== 'ALIVE') continue;
            
            const collision = this.world.getComponent(targetId, 'CollisionComponent');
            if (!collision) continue;

            if (this.raycaster.ray.intersectSphere(collision.boundingSphere, intersectionPoint)) {
                const distance = startPoint.distanceTo(intersectionPoint);
                if (!closestHit || distance < closestHit.distance) {
                    closestHit = {
                        entityId: targetId,
                        point: intersectionPoint.clone(),
                        distance: distance
                    };
                }
            }
        }
        return closestHit;
    }

    _getHardpointWorldPosition(transform, hardpoint) {
        const offset = new THREE.Vector3().fromArray(hardpoint.pos || [0, 0, 0]);
        return offset.applyQuaternion(transform.rotation).add(transform.position);
    }
}