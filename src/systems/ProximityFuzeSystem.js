import * as THREE from 'three';
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';

export class ProximityFuzeSystem extends System {
    constructor(world) {
        super(world);
        this.spatialGrid = serviceLocator.get('WorldManager').spatialGrid;
        this.queryBox = new THREE.Box3();
    }

    update(delta) {
        const entities = this.world.query(['MissileComponent', 'StateComponent', 'TransformComponent', 'HealthComponent']);

        for (const missileId of entities) {
            const missileHealth = this.world.getComponent(missileId, 'HealthComponent');
            const stateComp = this.world.getComponent(missileId, 'StateComponent');

            if (missileHealth.state !== 'ALIVE') continue;
            
            const armingState = stateComp.states.get('ARMING');
            if (armingState && armingState.timeLeft > 0) {
                continue;
            }

            const missile = this.world.getComponent(missileId, 'MissileComponent');
            const missileTransform = this.world.getComponent(missileId, 'TransformComponent');
            
            const proximityRadius = missile.weaponData.proximityFuze;
            if (!proximityRadius || proximityRadius <= 0) continue;

            const size = new THREE.Vector3(1, 1, 1).multiplyScalar(proximityRadius * 2);
            this.queryBox.setFromCenterAndSize(missileTransform.position, size);
            const nearby = this.spatialGrid.getNearby({ boundingBox: this.queryBox });

            for (const other of nearby) {
                const targetId = other.entityId;
                if (targetId === missileId || targetId === missile.originId) continue;

                const targetHealth = this.world.getComponent(targetId, 'HealthComponent');
                if (!targetHealth || targetHealth.state !== 'ALIVE') continue;
                
                const missileFaction = missile.faction;
                const targetFaction = this.world.getComponent(targetId, 'FactionComponent');
                if (targetFaction && targetFaction.name === missileFaction) continue;

                const targetTransform = this.world.getComponent(targetId, 'TransformComponent');
                if (targetTransform) {
                    const distance = missileTransform.position.distanceTo(targetTransform.position);
                    if (distance < proximityRadius) {
                        this.world.publish('detonation', {
                            missileId: missileId,
                            position: missileTransform.position.clone(),
                            targetId: targetId // Pass the target that triggered the fuze
                        });
                        missileHealth.state = 'DESTROYED';
                        return; 
                    }
                }
            }
        }
    }
}