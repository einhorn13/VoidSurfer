/**
 * Maps physical key inputs to logical game actions.
 * This is the foundation for allowing users to remap controls.
 */
class KeybindingManager {
    constructor() {
        this.keyToActionMap = new Map();
        this.initializeDefaults();
    }

    initializeDefaults() {
        // Movement
        this.bindKey('shift', 'ACCELERATE_FORWARD');
        this.bindKey('j', 'BOOST');
        this.bindKey('c', 'DRIFT');
        this.bindKey('q', 'STRAFE_LEFT');
        this.bindKey('e', 'STRAFE_RIGHT');
        
        // Turning (held)
        this.bindKey('a', 'TURN_YAW_LEFT');
        this.bindKey('arrowleft', 'TURN_YAW_LEFT');
        this.bindKey('d', 'TURN_YAW_RIGHT');
        this.bindKey('arrowright', 'TURN_YAW_RIGHT');
        this.bindKey('w', 'TURN_PITCH_UP');
        this.bindKey('arrowup', 'TURN_PITCH_UP');
        this.bindKey('s', 'TURN_PITCH_DOWN');
        this.bindKey('arrowdown', 'TURN_PITCH_DOWN');
        this.bindKey('z', 'TURN_ROLL_LEFT');
        this.bindKey('x', 'TURN_ROLL_RIGHT');
        
        // Mouse turning is a special case handled in the mapper
        this.bindKey('mouseleft', 'MOUSE_TURN');
        this.bindKey('mouseright', 'ACCELERATE_FORWARD');

        // Actions (single press)
        this.bindKey(' ', 'FIRE_WEAPON');
        this.bindKey('t', 'CYCLE_TARGET');
        this.bindKey('escape', 'DESELECT_TARGET');
        this.bindKey('g', 'DOCK');
        this.bindKey('m', 'TOGGLE_SYSTEM_MAP');
        
        // Weapon selection
        this.bindKey('1', 'SELECT_WEAPON_1');
        this.bindKey('2', 'SELECT_WEAPON_2');
        this.bindKey('3', 'SELECT_WEAPON_3');
        this.bindKey('4', 'SELECT_WEAPON_4');
        this.bindKey('5', 'SELECT_WEAPON_5');

        // Debug / Simulation Speed
        this.bindKey('pageup', 'INCREASE_SIM_SPEED');
        this.bindKey('pagedown', 'DECREASE_SIM_SPEED');
        this.bindKey('f7', 'TOGGLE_DEBUG_MODE');
    }

    bindKey(key, action) {
        this.keyToActionMap.set(key.toLowerCase(), action);
    }

    getActionForKey(key) {
        return this.keyToActionMap.get(key.toLowerCase());
    }
}

export const keybindingManager = new KeybindingManager();