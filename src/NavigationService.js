// src/NavigationService.js
import * as THREE from 'three';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';

/**
 * Manages the player's navigation target or route.
 * This decouples navigation logic from the Scanner.
 */
class NavigationService {
    constructor() {
        this.ecsWorld = null;
        this.scanner = null;
        
        this.currentTarget = null;
    }

    _getECSWorld() {
        if (!this.ecsWorld) this.ecsWorld = serviceLocator.get('ECSWorld');
        return this.ecsWorld;
    }

    _getScanner() {
        if (!this.scanner) this.scanner = serviceLocator.get('Scanner');
        return this.scanner;
    }

    setTarget(targetData) {
        this.currentTarget = {
            type: targetData.type,
            entityId: targetData.entityId || null,
            position: targetData.position,
            name: targetData.name
        };
        eventBus.emit('nav_target_updated', this.currentTarget);
    }

    clearTarget() {
        if (this.currentTarget) {
            this.currentTarget = null;
            eventBus.emit('nav_target_updated', null);
        }
    }
    
    getTarget() {
        if (this.currentTarget && this.currentTarget.type === 'entity' && this.currentTarget.entityId) {
            const ecs = this._getECSWorld();
            const transform = ecs.getComponent(this.currentTarget.entityId, 'TransformComponent');
            if (transform) {
                this.currentTarget.position.copy(transform.position);
            } else {
                this.clearTarget();
            }
        }
        return this.currentTarget;
    }

    /**
     * Returns a unified info object for the current target, suitable for UI display.
     */
    getCurrentTargetInfo() {
        const target = this.getTarget();
        if (!target) return null;

        const scanner = this._getScanner();
        const playerShipId = scanner.playerShipId;
        if (playerShipId === null) return null;

        if (target.type === 'entity') {
            return scanner.getTargetInfo(target.entityId);
        } else {
            // Manually construct info for non-entity targets
            const playerTransform = this._getECSWorld().getComponent(playerShipId, 'TransformComponent');
            if (playerTransform) {
                return {
                    name: target.name,
                    distance: playerTransform.position.distanceTo(target.position),
                    speed: 0,
                    faction: target.type.toUpperCase(),
                    relation: 'neutral',
                    health: null
                };
            }
        }
        
        return null;
    }
}

export const navigationService = new NavigationService();