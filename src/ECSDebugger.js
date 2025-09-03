import * as THREE from 'three';
import GUI from 'lil-gui';
import { serviceLocator } from './ServiceLocator.js';
import { eventBus } from './EventBus.js';

/**
 * A debug tool to inspect ECS entities and their components in real-time.
 * Press F7 to toggle. Selection is now synced with the in-game targeting system.
 */
export class ECSDebugger {
    constructor() {
        this.ecsWorld = serviceLocator.get('ECSWorld');
        this.scene = serviceLocator.get('Scene');
        this.camera = serviceLocator.get('Camera');
        this.navigationService = serviceLocator.get('NavigationService');

        this.gui = new GUI({ width: 350 });
        this.gui.title('ECS Inspector');
        this.gui.hide();

        this.selectedEntityId = null;
        this.entityFolder = null;
    }

    init() {
        eventBus.on('nav_target_updated', (target) => {
            if (this.gui._hidden) return;
            
            if (target && target.type === 'entity') {
                this.selectEntity(target.entityId);
            } else {
                this.deselectEntity();
            }
        });
    }

    toggle(show) {
        if (show) {
            this.gui.show();
            // On show, check current nav target and select it
            const currentTarget = this.navigationService.getTarget();
            if (currentTarget && currentTarget.type === 'entity') {
                this.selectEntity(currentTarget.entityId);
            }
        } else {
            this.gui.hide();
            this.deselectEntity();
        }
    }
    
    selectEntity(entityId) {
        if (this.selectedEntityId === entityId) return;
        this.selectedEntityId = entityId;
        this.rebuildGUI();
    }

    deselectEntity() {
        this.selectedEntityId = null;
        this.rebuildGUI();
    }
    
    rebuildGUI() {
        if (this.entityFolder) {
            this.entityFolder.destroy();
            this.entityFolder = null;
        }

        if (this.selectedEntityId === null) {
            this.gui.title('ECS Inspector');
            return;
        }
        
        const staticData = this.ecsWorld.getComponent(this.selectedEntityId, 'StaticDataComponent');
        const entityName = staticData?.data.name || `Entity ${this.selectedEntityId}`;

        this.gui.title(entityName);
        this.entityFolder = this.gui.addFolder('Components');
        
        for (const [componentName, componentMap] of this.ecsWorld.components.entries()) {
            if (componentMap.has(this.selectedEntityId)) {
                const component = componentMap.get(this.selectedEntityId);
                const compFolder = this.entityFolder.addFolder(componentName);

                for (const key in component) {
                    if (!Object.prototype.hasOwnProperty.call(component, key)) continue;
                    
                    const value = component[key];
                    if (typeof value === 'function') continue;
                    
                    if (value instanceof THREE.Vector3 || value instanceof THREE.Euler) {
                        const vectorFolder = compFolder.addFolder(key);
                        vectorFolder.add(value, 'x').listen();
                        vectorFolder.add(value, 'y').listen();
                        vectorFolder.add(value, 'z').listen();
                    } else if (value instanceof THREE.Quaternion) {
                        const quatFolder = compFolder.addFolder(key);
                        quatFolder.add(value, '_x').name('x').listen();
                        quatFolder.add(value, '_y').name('y').listen();
                        quatFolder.add(value, '_z').name('z').listen();
                        quatFolder.add(value, '_w').name('w').listen();
                    } else if (value instanceof Map) {
                        const mapFolder = compFolder.addFolder(key);
                        for (const [mapKey, mapValue] of value.entries()) {
                            mapFolder.add({ [mapKey]: JSON.stringify(mapValue) }, mapKey).disable();
                        }
                    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        if (Object.keys(value).length > 10 || value.uuid) continue;
                        
                        const objFolder = compFolder.addFolder(key);
                        for(const objKey in value) {
                            if (typeof value[objKey] !== 'function' && typeof value[objKey] !== 'object') {
                                 objFolder.add(value, objKey).listen();
                            }
                        }
                    } else {
                        try {
                            compFolder.add(component, key).listen();
                        } catch(e) {
                           // Ignore properties lil-gui can't handle
                        }
                    }
                }
            }
        }
        
        this.entityFolder.open();
    }
}