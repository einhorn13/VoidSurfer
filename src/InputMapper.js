// src/InputMapper.js
import { keyState, mouseState } from './InputController.js';
import { AccelerateCommand } from './commands/AccelerateCommand.js';
import { TurnCommand } from './commands/TurnCommand.js';
import { RollCommand } from './commands/RollCommand.js';
import { FireCommand } from './commands/FireCommand.js';
import { BoostCommand } from './commands/BoostCommand.js';
import { CycleTargetCommand } from './commands/CycleTargetCommand.js';
import { DeselectTargetCommand } from './commands/DeselectTargetCommand.js';
import { DockCommand } from './commands/DockCommand.js';

/**
 * Maps physical input (keyboard, mouse) to logical commands.
 */
export class InputMapper {
    constructor() {
        this.commandQueue = [];
    }

    update() {
        this.commandQueue = [];

        // Acceleration & Boost
        this.handleMovementCommands();
        
        // Turning
        this.handleTurningCommands();

        // Weapons & Targeting
        this.handleActionCommands();

        return this.commandQueue;
    }

    handleMovementCommands() {
        if (keyState['shift'] || keyState['mouseRight']) {
            this.commandQueue.push(new AccelerateCommand(true));
        }
        
        this.commandQueue.push(new BoostCommand(keyState['j']));
    }
    
    handleTurningCommands() {
        if (keyState.mouseLeft) {
            this.commandQueue.push(new TurnCommand('yaw', 0, true, mouseState));
            this.commandQueue.push(new TurnCommand('pitch', 0, true, mouseState));
        } else {
            if (keyState['a'] || keyState['arrowleft']) this.commandQueue.push(new TurnCommand('yaw', 1));
            if (keyState['d'] || keyState['arrowright']) this.commandQueue.push(new TurnCommand('yaw', -1));
            if (keyState['w'] || keyState['arrowup']) this.commandQueue.push(new TurnCommand('pitch', 1));
            if (keyState['s'] || keyState['arrowdown']) this.commandQueue.push(new TurnCommand('pitch', -1));
        }
        
        if (keyState['q']) this.commandQueue.push(new RollCommand(-1));
        if (keyState['e']) this.commandQueue.push(new RollCommand(1));
    }

    handleActionCommands() {
        if (keyState[' ']) {
            this.commandQueue.push(new FireCommand());
        }

        if (keyState['t']) {
            this.commandQueue.push(new CycleTargetCommand());
            keyState['t'] = false; // Consume the keypress
        }

        if (keyState['escape']) {
            this.commandQueue.push(new DeselectTargetCommand());
            keyState['escape'] = false; // Consume the keypress
        }
        
        // FIX: Add docking command
        if (keyState['g']) {
            this.commandQueue.push(new DockCommand());
            keyState['g'] = false; // Consume the keypress
        }
        
        // Weapon selection is handled directly in InputSystem for simplicity.
    }
}