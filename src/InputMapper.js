import { mouseState } from './InputController.js';
import { actionBuffer } from './ActionBuffer.js';
import { AccelerateCommand } from './commands/AccelerateCommand.js';
import { TurnCommand } from './commands/TurnCommand.js';
import { RollCommand } from './commands/RollCommand.js';
import { FireCommand } from './commands/FireCommand.js';
import { BoostCommand } from './commands/BoostCommand.js';
import { CycleTargetCommand } from './commands/CycleTargetCommand.js';
import { DeselectTargetCommand } from './commands/DeselectTargetCommand.js';
import { StrafeCommand } from './commands/StrafeCommand.js';
import { SelectWeaponCommand } from './commands/SelectWeaponCommand.js';

/**
 * Maps buffered actions to logical commands.
 */
export class InputMapper {
    constructor() {
        this.commandQueue = [];
    }

    mapActionsToCommands() {
        this.commandQueue = [];

        // Held down actions
        if (actionBuffer.isDown('ACCELERATE_FORWARD')) this.commandQueue.push(new AccelerateCommand(true));
        if (actionBuffer.isDown('STRAFE_LEFT')) this.commandQueue.push(new StrafeCommand(-1));
        if (actionBuffer.isDown('STRAFE_RIGHT')) this.commandQueue.push(new StrafeCommand(1));
        if (actionBuffer.isDown('MOUSE_TURN')) {
            this.commandQueue.push(new TurnCommand('yaw', 0, true, mouseState));
            this.commandQueue.push(new TurnCommand('pitch', 0, true, mouseState));
        } else {
            if (actionBuffer.isDown('TURN_YAW_LEFT')) this.commandQueue.push(new TurnCommand('yaw', 1));
            if (actionBuffer.isDown('TURN_YAW_RIGHT')) this.commandQueue.push(new TurnCommand('yaw', -1));
            if (actionBuffer.isDown('TURN_PITCH_UP')) this.commandQueue.push(new TurnCommand('pitch', 1));
            if (actionBuffer.isDown('TURN_PITCH_DOWN')) this.commandQueue.push(new TurnCommand('pitch', -1));
        }
        if (actionBuffer.isDown('TURN_ROLL_LEFT')) this.commandQueue.push(new RollCommand(-1));
        if (actionBuffer.isDown('TURN_ROLL_RIGHT')) this.commandQueue.push(new RollCommand(1));
        if (actionBuffer.isDown('FIRE_WEAPON')) this.commandQueue.push(new FireCommand());
        
        // Single press actions
        if (actionBuffer.isPressed('CYCLE_TARGET')) this.commandQueue.push(new CycleTargetCommand());
        if (actionBuffer.isPressed('DESELECT_TARGET')) this.commandQueue.push(new DeselectTargetCommand());
        
        if (actionBuffer.isPressed('BOOST')) this.commandQueue.push(new BoostCommand(true));
        if (actionBuffer.isReleased('BOOST')) this.commandQueue.push(new BoostCommand(false));
        
        if (actionBuffer.isPressed('SELECT_WEAPON_1')) this.commandQueue.push(new SelectWeaponCommand(0));
        if (actionBuffer.isPressed('SELECT_WEAPON_2')) this.commandQueue.push(new SelectWeaponCommand(1));
        if (actionBuffer.isPressed('SELECT_WEAPON_3')) this.commandQueue.push(new SelectWeaponCommand(2));
        if (actionBuffer.isPressed('SELECT_WEAPON_4')) this.commandQueue.push(new SelectWeaponCommand(3));
        if (actionBuffer.isPressed('SELECT_WEAPON_5')) this.commandQueue.push(new SelectWeaponCommand(4));

        return this.commandQueue;
    }
}