// src/ecs/World.js
export class World {
    constructor() {
        this.entityIds = new Set(); // Changed from Map to Set
        this.components = new Map();
        this.systems = [];
        this.nextEntityId = 0;
        this.eventQueues = new Map();
    }

    createEntity() {
        const entityId = this.nextEntityId++;
        this.entityIds.add(entityId);
        return entityId;
    }

    hasEntity(entityId) {
        return this.entityIds.has(entityId);
    }

    addComponent(entityId, component) {
        const componentName = component.constructor.name;
        if (!this.components.has(componentName)) {
            this.components.set(componentName, new Map());
        }
        this.components.get(componentName).set(entityId, component);
    }

    getComponent(entityId, componentName) {
        const componentMap = this.components.get(componentName);
        return componentMap ? componentMap.get(entityId) : undefined;
    }



    removeEntity(entityId) {
        for (const componentMap of this.components.values()) {
            componentMap.delete(entityId);
        }
        this.entityIds.delete(entityId); // Changed from this.entities.delete
    }

    addSystem(system) {
        this.systems.push(system);
    }

    query(componentNames) {
        const entities = [];
        if (componentNames.length === 0) return entities;

        const firstComponentMap = this.components.get(componentNames[0]);
        if (!firstComponentMap) return entities;

        for (const entityId of firstComponentMap.keys()) {
            let hasAllComponents = true;
            for (let i = 1; i < componentNames.length; i++) {
                const componentMap = this.components.get(componentNames[i]);
                if (!componentMap || !componentMap.has(entityId)) {
                    hasAllComponents = false;
                    break;
                }
            }
            if (hasAllComponents) {
                entities.push(entityId);
            }
        }
        return entities;
    }

    publish(eventName, eventData) {
        if (!this.eventQueues.has(eventName)) {
            this.eventQueues.set(eventName, []);
        }
        this.eventQueues.get(eventName).push(eventData);
    }

    getEvents(eventName) {
        return this.eventQueues.get(eventName) || [];
    }

    clearEvents() {
        this.eventQueues.clear();
    }

    update(delta) {
        for (const system of this.systems) {
            system.update(delta);
        }
        // Clear events AFTER all systems have had a chance to process them for the current frame.
        this.clearEvents();
    }
}