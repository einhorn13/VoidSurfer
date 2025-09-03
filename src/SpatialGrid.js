// src/SpatialGrid.js
import * as THREE from 'three';

export class SpatialGrid {
    constructor(worldSize = 8000, divisions = 80) {
        this.worldSize = worldSize;
        this.divisions = divisions;
        this.cellSize = worldSize / divisions;
        this.halfWorldSize = worldSize / 2;
        this.grid = new Map();
        this.queryIds = new Set();
    }

    _getGridCoords(position) {
        const x = Math.floor((position.x + this.halfWorldSize) / this.cellSize);
        const y = Math.floor((position.y + this.halfWorldSize) / this.cellSize);
        const z = Math.floor((position.z + this.halfWorldSize) / this.cellSize);
        return { x, y, z };
    }

    _getCellKey(coords) {
        return `${coords.x},${coords.y},${coords.z}`;
    }

    clear() {
        this.grid.clear();
    }

    // UPDATED: Now accepts a category for pre-filtering queries.
    register(object, category = 'other') {
        const boundingBox = object.collision ? object.collision.boundingBox : object.boundingBox;
        if (!boundingBox || boundingBox.isEmpty()) return;

        const min = this._getGridCoords(boundingBox.min);
        const max = this._getGridCoords(boundingBox.max);
        
        // The object stored now includes its category.
        const categorizedObject = { ...object, category };

        for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
                for (let z = min.z; z <= max.z; z++) {
                    const key = this._getCellKey({ x, y, z });
                    if (!this.grid.has(key)) {
                        this.grid.set(key, []);
                    }
                    this.grid.get(key).push(categorizedObject);
                }
            }
        }
    }

    // UPDATED: Now accepts an optional categoryFilter.
    getNearby(object, categoryFilter = null) {
        this.queryIds.clear();
        const results = [];
        
        const boundingBox = object.collision ? object.collision.boundingBox : object.boundingBox;
        if (!boundingBox || boundingBox.isEmpty()) return results;

        const min = this._getGridCoords(boundingBox.min);
        const max = this._getGridCoords(boundingBox.max);
        
        for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
                for (let z = min.z; z <= max.z; z++) {
                    const key = this._getCellKey({ x, y, z });
                    if (this.grid.has(key)) {
                        for (const cellObject of this.grid.get(key)) {
                            // Apply category filter if provided.
                            if (categoryFilter && cellObject.category !== categoryFilter) {
                                continue;
                            }
                            
                            let uniqueId;
                            if (cellObject.entityId !== undefined) {
                                uniqueId = `e-${cellObject.entityId}`;
                            } else if (cellObject.instanceId !== undefined) {
                                uniqueId = `${cellObject.typeId}-${cellObject.instanceId}`;
                            } else {
                                continue;
                            }

                            if (!this.queryIds.has(uniqueId)) {
                                results.push(cellObject);
                                this.queryIds.add(uniqueId);
                            }
                        }
                    }
                }
            }
        }
        return results;
    }
}