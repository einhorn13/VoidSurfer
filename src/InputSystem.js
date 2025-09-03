import { System } from '../ecs/System.js';
import { serviceLocator } from '../ServiceLocator.js';
import { InputMapper } from '../InputMapper.js';
import { actionBuffer } from './ActionBuffer.js';
import * as THREE from 'three';

export class InputSystem extends System {
    constructor(world) {
        super(world);
        this.gameStateManager = serviceLocator.get('GameStateManager');
        this.eventBus = serviceLocator.get('eventBus');
        this.worldManager = serviceLocator.get('WorldManager');
        this.systemMapManager = serviceLocator.get('SystemMapManager');
        this.inputMapper = new InputMapper.js';
        
        const balanceConfig = serviceLocator.get('DataManager').getConfig('game_balance');
        this.driftConfig = balanceConfig.playerAbilities.drift;
    }

    update(delta) {
        // Global, non-entity actions are handled here
        if (this.gameStateManager.isArcadeMode()) {
            if (actionBuffer.isPressed('INCREASE_SIM_SPEED')) this.gameStateManager.increaseSimulationSpeed();
            if (actionBuffer.isPressed('DECREASE_SIM_SPEED')) this.gameStateManager.decreaseSimulationSpeed();
        }

        const playerIds = this.world.query(['PlayerControlledComponent']);
        if (playerIds.length === 0) {
            actionBuffer.update();
            return;
        }
        
        const playerEntityId = playerIds[0];
        
        this.handleDockingPrompt(playerEntityId);
        
        if (actionBuffer.isPressed('TOGGLE_SYSTEM_MAP')) {
            this.systemMapManager.toggle();
        }
        
        if (this.gameStateManager.getCurrentState() === 'DOCKED' && actionBuffer.isPressed('DOCK')) {
            this.eventBus.emit('undock_request');
        }

        if (!this.gameStateManager.isPlayerControlEnabled()) {
            actionBuffer.update();
            return;
        }

        const health = this.world.getComponent(playerEntityId, 'HealthComponent');
        if (health.state !== 'ALIVE') {
            actionBuffer.update();
            return;
        }

        const commandQueueComp = this.world.getComponent(playerEntityId, 'CommandQueueComponent');
        if (!commandQueueComp) {
            actionBuffer.update();
            return;
        }

        const physics = this.world.getComponent(playerEntityId, 'PhysicsComponent');
        if (physics) {
            physics.isAccelerating = false;
            physics.strafeDirection = 0;
        }

        if (actionBuffer.isPressed('DOCK')) {
            this.handleDockingAttempt(playerEntityId);
        }

        if (actionBuffer.isPressed('DRIFT')) {
            this.handleDriftAttempt(playerEntityId);
        }
        
        // Entity-specific actions are mapped to commands
        const commands = this.inputMapper.mapActionsToCommands();
        for (const command of commands) {
            commandQueueComp.queue.push(command);
        }
        
        actionBuffer.update();
    }
    
    handleDriftAttempt(entityId) {
        const stateComp = this.world.getComponent(entityId, 'StateComponent');
        const energy = this.world.getComponent(entityId, 'EnergyComponent');
        const physics = this.world.getComponent(entityId, 'PhysicsComponent');
        const transform = this.world.getComponent(entityId, 'TransformComponent');

        if (!stateComp || !energy || !physics || !transform) return;

        if (stateComp.states.has('DRIFT_ACTIVE') || stateComp.states.has('DRIFT_COOLDOWN') || energy.current < this.driftConfig.energyCost) {
            return;
        }

        energy.current -= this.driftConfig.energyCost;
        stateComp.states.set('DRIFT_ACTIVE', { timeLeft: this.driftConfig.duration, duration: this.driftConfig.duration });
        stateComp.states.set('DRIFT_COOLDOWN', { timeLeft: this.driftConfig.cooldown, duration: this.driftConfig.cooldown });
        
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(transform.rotation);
        const impulseMagnitude = physics.maxSpeed * 0.5;
        const impulse = forward.multiplyScalar(impulseMagnitude);
        physics.velocity.add(impulse);
        
        const absoluteMaxSpeed = physics.maxSpeed * 4.0;
        if (physics.velocity.lengthSq() > absoluteMaxSpeed * absoluteMaxSpeed) {
            physics.velocity.setLength(absoluteMaxSpeed);
        }
        
        this.eventBus.emit('notification', { text: 'Drift Mode Engaged', type: 'info' });
    }
    
    handleDockingAttempt(playerEntityId) {
        if (this.isDockingPossible(playerEntityId)) {
            const scanner = serviceLocator.get('Scanner');
            scanner.setNavTarget(this.worldManager.stationEntityId);
            this.eventBus.emit('dock_request');
        }
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
        const dockable = this.world.getComponent(this.worldManager.stationEntityId, 'DockableComponent');
        const playerTransform = this.world.getComponent(playerEntityId, 'TransformComponent');
        const playerPhysics = this.world.getComponent(playerEntityId, 'PhysicsComponent');
        
        if (stationTransform && dockable && playerTransform && playerPhysics) {
            const distance = stationTransform.position.distanceTo(playerTransform.position);
            const speed = playerPhysics.velocity.length();
            return distance < dockable.dockingRadius && speed < dockable.maxDockingSpeed;
        }
        return false;
    }
}