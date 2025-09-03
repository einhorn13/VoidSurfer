// src/utils/WorldToScreenMapper.js
import * as THREE from 'three';

const POINTER_PADDING = 50; // Pixels from the edge of the screen

/**
 * A utility class to handle conversions between 3D world coordinates
 * and 2D screen coordinates, including off-screen indicators.
 */
export class WorldToScreenMapper {
    constructor(camera) {
        this.camera = camera;
        this.projectedPosition = new THREE.Vector3();
    }

    /**
     * Projects a 3D world position to 2D screen coordinates.
     * @param {THREE.Vector3} worldPosition - The position in world space.
     * @returns {{x: number, y: number, onScreen: boolean}} Screen coordinates and visibility.
     */
    project(worldPosition) {
        this.projectedPosition.copy(worldPosition).project(this.camera);

        return {
            x: (this.projectedPosition.x * 0.5 + 0.5) * window.innerWidth,
            y: (-this.projectedPosition.y * 0.5 + 0.5) * window.innerHeight,
            // 'onScreen' here only means it's in front of the camera's near plane.
            // It does not guarantee it's within the visible XY bounds of the screen.
            onScreen: this.projectedPosition.z <= 1
        };
    }

    /**
     * Calculates the position and rotation for an off-screen pointer.
     * Assumes the target is already determined to be off-screen.
     * @param {THREE.Vector3} worldPosition - The position in world space.
     * @returns {{x: number, y: number, rotation: number}} Pointer data.
     */
    getOffscreenPointerData(worldPosition) {
        this.projectedPosition.copy(worldPosition).project(this.camera);
        
        // If target is behind, project it onto the edge of the screen plane for a stable pointer
        if (this.projectedPosition.z > 1) {
            this.projectedPosition.multiplyScalar(-1);
        }

        const screenX = this.projectedPosition.x;
        const screenY = this.projectedPosition.y;

        const angle = Math.atan2(screenY, screenX);
        const rotation = angle; // The arrow sprite should point from the center

        const screenAspect = window.innerWidth / window.innerHeight;
        
        // Find intersection with screen bounds in normalized device coordinates
        let x, y;
        if (Math.abs(screenX / screenAspect) > Math.abs(screenY)) {
            x = Math.sign(screenX) * screenAspect;
            y = x * Math.tan(angle);
        } else {
            y = Math.sign(screenY);
            x = y / Math.tan(angle) * screenAspect;
        }

        // Convert back to pixel coordinates and apply padding
        const finalX = (x / screenAspect * 0.5 + 0.5) * window.innerWidth;
        const finalY = (-y * 0.5 + 0.5) * window.innerHeight;
        
        const paddedX = THREE.MathUtils.clamp(finalX, POINTER_PADDING, window.innerWidth - POINTER_PADDING);
        const paddedY = THREE.MathUtils.clamp(finalY, POINTER_PADDING, window.innerHeight - POINTER_PADDING);

        // Adjust rotation to point from the screen center towards the off-screen target
        const finalAngle = Math.atan2(paddedY - window.innerHeight / 2, paddedX - window.innerWidth / 2);

        return { x: paddedX, y: paddedY, rotation: finalAngle + Math.PI / 2 };
    }
}