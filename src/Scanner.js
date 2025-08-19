// src/Scanner.js
import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';

// The maximum angle (in radians) away from the ship's forward vector
// for a target to be considered for cycling.
// ~15 degrees. A larger value makes targeting easier.
const TARGET_CYCLE_CONE_ANGLE = 0.26;

export class Scanner {
    constructor() {
        this.camera = serviceLocator.get('Camera');
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.targets = [];
        this.navTargetId = null;
        this.playerShipId = null;
        this.allTargetableIds = [];
    }

    update(playerShipId, allTargetableIds) {
        this.playerShipId = playerShipId;
        this.allTargetableIds = allTargetableIds;

        this.targets = [];
        const playerTransform = this.ecsWorld.getComponent(playerShipId, 'TransformComponent');
        if (!playerTransform) return;
        
        allTargetableIds.forEach(targetId => {
            const health = this.ecsWorld.getComponent(targetId, 'HealthComponent');
            if (!health || health.isDestroyed || targetId === playerShipId) return;

            const targetTransform = this.ecsWorld.getComponent(targetId, 'TransformComponent');
            if (!targetTransform) return;
            
            const distance = playerTransform.position.distanceTo(targetTransform.position);
            
            const staticData = this.ecsWorld.getComponent(targetId, 'StaticDataComponent');
            const factionComp = this.ecsWorld.getComponent(targetId, 'FactionComponent');

            // FIX: Handle both ships and collectibles for scanner display
            if (staticData?.data.type === 'ship' && factionComp) {
                this.targets.push({ entityId: targetId, distance, faction: factionComp.name });
            } else if (staticData?.data.type === 'salvage' || staticData?.data.type === 'item') {
                this.targets.push({ entityId: targetId, distance, faction: 'LOOT' }); // Use a special category for UI
            }
        });
        
        this.targets.sort((a, b) => a.distance - b.distance);

        const navTargetHealth = this.ecsWorld.getComponent(this.navTargetId, 'HealthComponent');
        if (navTargetHealth && navTargetHealth.isDestroyed) {
            this.navTargetId = null;
        }
    }

    setNavTarget(targetId) {
        this.navTargetId = targetId;
    }

    deselectTarget() {
        this.navTargetId = null;
    }

    cycleTarget() {
        if (this.playerShipId === null || !this.camera) return;

        const playerTransform = this.ecsWorld.getComponent(this.playerShipId, 'TransformComponent');
        if (!playerTransform) return;

        const potentialTargetIds = this.allTargetableIds.filter(id => {
            const health = this.ecsWorld.getComponent(id, 'HealthComponent');
            return id !== this.playerShipId && (!health || !health.isDestroyed);
        });

        if (potentialTargetIds.length === 0) {
            this.navTargetId = null;
            return;
        }

        const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(playerTransform.rotation);
        const scoredTargets = [];

        for (const targetId of potentialTargetIds) {
            const targetTransform = this.ecsWorld.getComponent(targetId, 'TransformComponent');
            if (!targetTransform) continue;
            
            const directionToTarget = new THREE.Vector3().subVectors(targetTransform.position, playerTransform.position).normalize();
            
            // --- CONE SELECTION LOGIC ---
            const angle = forwardVector.angleTo(directionToTarget);
            if (angle > TARGET_CYCLE_CONE_ANGLE) {
                continue; // Skip target if it's outside the selection cone
            }
            
            const screenPos = targetTransform.position.clone().project(this.camera);
            if (screenPos.z > 1) continue; // Behind the camera

            const score = Math.sqrt(screenPos.x**2 + screenPos.y**2); // Distance from center of screen
            scoredTargets.push({ targetId, score });
        }

        if (scoredTargets.length === 0) {
            // If no target is in the cone, clear the current target
            this.navTargetId = null;
            return;
        }

        scoredTargets.sort((a, b) => a.score - b.score);

        const sortedTargetIds = scoredTargets.map(st => st.targetId);
        
        let currentIndex = -1;
        if (this.navTargetId !== null) {
            currentIndex = sortedTargetIds.findIndex(id => id === this.navTargetId);
        }

        const nextIndex = (currentIndex + 1) % sortedTargetIds.length;
        this.setNavTarget(sortedTargetIds[nextIndex]);
    }
}