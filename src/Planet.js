import * as THREE from 'three';

/**
 * Represents a static celestial body like a planet or a moon.
 */
export class Planet {
    constructor(scene, planetData) {
        this.data = planetData;
        
        const geometry = new THREE.SphereGeometry(this.data.size, 32, 16);
        const material = new THREE.MeshStandardMaterial({
            color: parseInt(this.data.color, 16),
            metalness: 0.1,
            roughness: 0.8
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(...this.data.position);
        
        // --- NEW: Add userData for collision identification and compute bounding sphere ---
        this.mesh.userData.object = this; 
        
        this.boundingSphere = new THREE.Sphere();
        // Force update of world matrix for correct sphere position
        this.mesh.updateMatrixWorld(true); 
        this.boundingSphere.set(this.mesh.position, this.data.size);

        scene.add(this.mesh);
    }
}