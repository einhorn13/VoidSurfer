import { serviceLocator } from '../ServiceLocator.js';

/**
 * A base class for assemblers to avoid boilerplate code.
 * Provides access to common services.
 */
export class BaseAssembler {
    constructor() {
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.dataManager = serviceLocator.get('DataManager');
        this.scene = serviceLocator.get('Scene');
    }
}