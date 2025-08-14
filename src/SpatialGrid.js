// src/SpatialGrid.js
import * as THREE from 'three';

// A simple 3D spatial grid for broad-phase collision detection.
export class SpatialGrid {
    constructor(worldSize = 8000, divisions = 80) {
        this.worldSize = worldSize;
        this.divisions = divisions;
        this.cellSize = worldSize / divisions;
        this.halfWorldSize = worldSize / 2;
        this.grid = new Map();
        this.queryIds = new Set(); // Used to avoid returning duplicate objects in a query
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

    // Clears the grid for the new frame.
    clear() {
        this.grid.clear();
    }

    // Registers an object (like a ship or asteroid) into the grid.
    register(object) {
        // We use the object's boundingBox for registration
        const min = this._getGridCoords(object.boundingBox.min);
        const max = this._getGridCoords(object.boundingBox.max);

        for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
                for (let z = min.z; z <= max.z; z++) {
                    const key = this._getCellKey({ x, y, z });
                    if (!this.grid.has(key)) {
                        this.grid.set(key, []);
                    }
                    this.grid.get(key).push(object);
                }
            }
        }
    }

    // Retrieves all unique objects that are in the same cell(s) as the given object.
    getNearby(object) {
        this.queryIds.clear();
        const results = [];
        
        const min = this._getGridCoords(object.boundingBox.min);
        const max = this._getGridCoords(object.boundingBox.max);
        
        for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
                for (let z = min.z; z <= max.z; z++) {
                    const key = this._getCellKey({ x, y, z });
                    if (this.grid.has(key)) {
                        for (const cellObject of this.grid.get(key)) {
                            // Use a Set to ensure we don't add the same object multiple times
                            if (!this.queryIds.has(cellObject.mesh.id)) {
                                results.push(cellObject);
                                this.queryIds.add(cellObject.mesh.id);
                            }
                        }
                    }
                }
            }
        }
        return results;
    }
}