class EntityBuilder {
    constructor(world, entityId) {
        this.world = world;
        this.entityId = entityId;
    }

    /**
     * Adds a component to the entity being built.
     * @param {Component} component The component instance to add.
     * @returns {EntityBuilder} The builder instance for chaining.
     */
    with(component) {
        this.world.addComponent(this.entityId, component);
        return this;
    }

    /**
     * Finalizes the entity and returns its ID.
     * @returns {number} The ID of the created entity.
     */
    build() {
        return this.entityId;
    }
}


export class World {
    constructor() {
        this.entityIds = new Set();
        this.components = new Map();
        this.systems = [];
        this.nextEntityId = 0;
        this.eventQueues = new Map();
    }

    createEntity() {
        const entityId = this.nextEntityId++;
        this.entityIds.add(entityId);
        return new EntityBuilder(this, entityId);
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

    removeComponent(entityId, componentName) {
        const componentMap = this.components.get(componentName);
        if (componentMap) {
            componentMap.delete(entityId);
        }
    }

    removeEntity(entityId) {
        for (const componentMap of this.components.values()) {
            componentMap.delete(entityId);
        }
        this.entityIds.delete(entityId);
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
        this.clearEvents();
    }
}