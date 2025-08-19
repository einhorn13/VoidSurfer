// src/systems/InputSystem.js
import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { InputMapper } from '../InputMapper.js';
import { keyState } from '../InputController.js';
import { DockCommand } from '../commands/DockCommand.js';

export class InputSystem extends System {
    constructor(world) {
        super(world);
        this.entityAssembler = serviceLocator.get('EntityFactory');
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.scanner = serviceLocator.get('Scanner');
        this.dataManager = serviceLocator.get('DataManager');
        this.eventBus = serviceLocator.get('eventBus');
        this.worldManager = serviceLocator.get('WorldManager'); // Need this for station info

        this.inputMapper = new InputMapper();

        this.balanceConfig = this.dataManager.getConfig('game_balance');
        this.boostConfig = this.balanceConfig.playerBoost;
        this.weaponConfig = this.balanceConfig.gameplay.weapons;

        // State that needs to be managed by the system
        this.isBoosting = false;
        this.primaryWeaponCooldown = 0;
        this.missileCooldown = 0;
        this.launchFailureNotificationTimer = 0;
    }

    update(delta) {
        const playerIds = this.world.query(['PlayerControlledComponent']);
        if (playerIds.length === 0) return;
        
        const playerEntityId = playerIds[0];
        const physics = this.world.getComponent(playerEntityId, 'PhysicsComponent');
        if (physics) {
            physics.isAccelerating = false; // Reset acceleration flag each frame
        }

        this.handleDockingPrompt(playerEntityId);

        if (!this.gameStateManager.isPlayerControlEnabled()) {
            return;
        }

        const health = this.world.getComponent(playerEntityId, 'HealthComponent');
        if (health.isDestroyed) return;

        // Update cooldowns
        if (this.primaryWeaponCooldown > 0) this.primaryWeaponCooldown -= delta;
        if (this.missileCooldown > 0) this.missileCooldown -= delta;
        if (this.launchFailureNotificationTimer > 0) this.launchFailureNotificationTimer -= delta;

        // Get commands from the mapper
        const commands = this.inputMapper.update();
        
        // Prepare a services object for commands
        const commandServices = {
            delta,
            inputSystem: this,
            scanner: this.scanner,
            entityAssembler: this.entityAssembler
        };

        // Execute all commands
        for (const command of commands) {
            if (command instanceof DockCommand) {
                this.handleDockingAttempt(playerEntityId);
            } else {
                command.execute(playerEntityId, this.world, commandServices);
            }
        }

        // Handle direct state changes like weapon selection
        this.handleWeaponSelection(playerEntityId);
    }

    handleDockingPrompt(playerEntityId) {
        if (this.gameStateManager.getCurrentState() === 'DOCKED' || !this.worldManager.stationEntityId) {
            this.eventBus.emit('docking_prompt_update', false);
            return;
        }

        const isDockingPossible = this.isDockingPossible(playerEntityId);
        this.eventBus.emit('docking_prompt_update', isDockingPossible);
    }
    
    isDockingPossible(playerEntityId) {
        const stationTransform = this.world.getComponent(this.worldManager.stationEntityId, 'TransformComponent');
        const stationComp = this.world.getComponent(this.worldManager.stationEntityId, 'StationComponent');
        const playerTransform = this.world.getComponent(playerEntityId, 'TransformComponent');
        const playerPhysics = this.world.getComponent(playerEntityId, 'PhysicsComponent');

        if (stationTransform && stationComp && playerTransform && playerPhysics) {
            const distance = stationTransform.position.distanceTo(playerTransform.position);
            const speed = playerPhysics.velocity.length();
            return distance < stationComp.dockingRadius && speed < stationComp.maxDockingSpeed;
        }
        return false;
    }

    handleDockingAttempt(playerEntityId) {
        if (this.isDockingPossible(playerEntityId)) {
            this.eventBus.emit('dock_request');
        }
    }

    handleWeaponSelection(entityId) {
        const hardpoints = this.world.getComponent(entityId, 'HardpointComponent');
        if (!hardpoints) return;
        
        const weaponKeys = ['1', '2', '3', '4', '5'];
        for (let i = 0; i < weaponKeys.length; i++) {
            if (keyState[weaponKeys[i]] && hardpoints.hardpoints.length > i) {
                hardpoints.selectedWeaponIndex = i;
            }
        }
    }

    // This method is now used by FireCommand to show notifications
    _notifyLaunchFailure(message) {
        if (this.launchFailureNotificationTimer <= 0) {
            this.eventBus.emit('notification', { text: message, type: 'warning', duration: 2.0 });
            this.launchFailureNotificationTimer = 2.0;
        }
    }
}