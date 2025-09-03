// src/systems/HealthBarSystem.js
import { System } from '../ecs/System.js';
import * as THREE from 'three';
import { serviceLocator } from '../ServiceLocator.js';

export class HealthBarSystem extends System {
    constructor(world) {
        super(world);
        this.camera = serviceLocator.get('Camera');
        this.scanner = serviceLocator.get('Scanner');
    }

    update(delta) {
        // Added CollisionComponent to get the bounding sphere for positioning
        const entities = this.world.query(['HealthComponent', 'HealthBarComponent', 'TransformComponent', 'CollisionComponent']);
        const playerTargetId = this.scanner.navTargetId;

        for (const entityId of entities) {
            const healthBar = this.world.getComponent(entityId, 'HealthBarComponent');
            if (this.world.getComponent(entityId, 'PlayerControlledComponent')) {
                healthBar.sprite.visible = false;
                continue;
            }

            const healthComp = this.world.getComponent(entityId, 'HealthComponent');
            const transform = this.world.getComponent(entityId, 'TransformComponent');
            const collision = this.world.getComponent(entityId, 'CollisionComponent');

            const isDamaged = healthComp.hull.current < healthComp.hull.max || healthComp.shield.current < healthComp.shield.max;
            const isTargeted = entityId === playerTargetId;
            
            // OPTIMIZATION: Check if health has changed before redrawing
            const healthChanged = healthBar.lastKnownHull !== healthComp.hull.current || healthBar.lastKnownShield !== healthComp.shield.current;
            if (healthChanged) {
                healthBar.needsUpdate = true;
            }

            if (healthComp.isDestroyed || (!isDamaged && !isTargeted)) {
                if (healthBar.sprite.visible) {
                    healthBar.sprite.visible = false;
                }
                continue;
            }
            
            if (!healthBar.sprite.visible) {
                healthBar.sprite.visible = true;
            }

            // Calculate dynamic offset based on ship size (bounding sphere radius)
            const yOffset = collision.boundingSphere.radius * 1.5;
            healthBar.sprite.position.copy(transform.position).y += yOffset;

            // Ensure the sprite always faces the camera
            healthBar.sprite.quaternion.copy(this.camera.quaternion);
            
            // OPTIMIZATION: Only redraw if necessary
            if (healthBar.needsUpdate) {
                this.drawCompositeHealthBar(healthBar, healthComp);
                healthBar.lastKnownHull = healthComp.hull.current;
                healthBar.lastKnownShield = healthComp.shield.current;
                healthBar.needsUpdate = false;
            }
        }
    }

    drawCompositeHealthBar(healthBar, healthComp) {
        const ctx = healthBar.context;
        const canvas = healthBar.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barHeight = 12;
        const barY = (canvas.height - barHeight) / 2;
        const padding = 2;
        const innerWidth = canvas.width - padding * 2;
        const innerHeight = barHeight - padding * 2;

        const totalMaxHealth = healthComp.hull.max + healthComp.shield.max;
        const hullPercentOfTotal = healthComp.hull.current / totalMaxHealth;
        const shieldPercentOfTotal = healthComp.shield.current / totalMaxHealth;
        
        const hullWidth = innerWidth * hullPercentOfTotal;
        const shieldWidth = innerWidth * shieldPercentOfTotal;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, barY, canvas.width, barHeight);

        // Hull bar
        const hullPercent = healthComp.hull.current / healthComp.hull.max;
        const hullColor = hullPercent > 0.5 ? '#00cc00' : (hullPercent > 0.25 ? '#cccc00' : '#cc0000');
        ctx.fillStyle = hullColor;
        ctx.fillRect(padding, barY + padding, hullWidth, innerHeight);

        // Shield bar (drawn on top of the hull bar)
        if (shieldWidth > 0) {
            ctx.fillStyle = 'rgba(0, 170, 255, 0.85)'; // semi-transparent blue
            ctx.fillRect(padding + hullWidth, barY + padding, shieldWidth, innerHeight);
        }

        // Border
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, barY + 0.5, canvas.width - 1, barHeight - 1);
        
        healthBar.sprite.material.map.needsUpdate = true;
    }
}