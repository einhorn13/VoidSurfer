// src/commands/Command.js
/**
 * Base class for all commands.
 */
export class Command {
    execute() {
        throw new Error('Command.execute() must be implemented by subclass');
    }
}