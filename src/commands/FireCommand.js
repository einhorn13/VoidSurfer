// src/commands/FireCommand.js
import { ShipCommand } from './ShipCommand.js';

export class FireCommand extends ShipCommand {
    execute(entityId, world, services) {
        const { inputSystem } = services;

        const hardpoints = world.getComponent(entityId, 'HardpointComponent');
        const energy = world.getComponent(entityId, 'EnergyComponent');
        const ammo = world.getComponent(entityId, 'AmmoComponent');
        if (!hardpoints || !energy || !ammo) return;

        const currentHardpoint = hardpoints.hardpoints[hardpoints.selectedWeaponIndex];
        if (!currentHardpoint) return;

        const weapon = currentHardpoint.weapon;
        
        // Cooldown Check
        if (weapon.type === 'HOMING' && inputSystem.missileCooldown > 0) return;
        if (weapon.type !== 'HOMING' && inputSystem.primaryWeaponCooldown > 0) return;

        // Resource Check
        if (energy.current < weapon.energyCost) return;
        const currentAmmo = ammo.ammo.get(weapon.ammoType) || 0;
        if (weapon.ammoType && currentAmmo < weapon.ammoCost) return;
        
        let targetId = null;
        if (weapon.type === 'HOMING') {
            targetId = this._getValidMissileTarget(entityId, world, services);
            if (targetId === null) return;
        }

        // Consume resources
        energy.current -= weapon.energyCost;
        if (weapon.ammoType) ammo.ammo.set(weapon.ammoType, currentAmmo - weapon.ammoCost);

        // Set cooldowns
        if (weapon.type === 'HOMING') {
            inputSystem.missileCooldown = weapon.fireRate;
        } else {
            inputSystem.primaryWeaponCooldown = weapon.fireRate;
        }

        // Publish a fire event instead of creating an entity
        world.publish('fire_weapon', { 
            originId: entityId, 
            hardpoint: currentHardpoint, 
            targetId: targetId 
        });
    }

    _getValidMissileTarget(entityId, world, services) {
        const { scanner, inputSystem } = services;
        const navTargetId = scanner.navTargetId;
        const targetHealth = world.getComponent(navTargetId, 'HealthComponent');
        
        if (!navTargetId || !targetHealth || targetHealth.isDestroyed) {
            inputSystem._notifyLaunchFailure('No target locked');
            return null;
        }

        const targetStaticData = world.getComponent(navTargetId, 'StaticDataComponent');
        if (targetStaticData?.data?.type !== 'ship') {
            inputSystem._notifyLaunchFailure('Invalid missile target');
            return null;
        }

        const playerTransform = world.getComponent(entityId, 'TransformComponent');
        const targetTransform = world.getComponent(navTargetId, 'TransformComponent');
        const distance = playerTransform.position.distanceTo(targetTransform.position);
        const weaponConfig = inputSystem.weaponConfig;

        if (distance < weaponConfig.missileMinRange || distance > weaponConfig.missileMaxRange) {
            inputSystem._notifyLaunchFailure('Target out of missile range');
            return null;
        }
        return navTargetId;
    }
}