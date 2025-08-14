import * as THREE from 'three';

export class Asteroid {
    constructor(scene, type, position, asteroidData) {
        this.type = type;
        this.data = asteroidData;
        this.health = this.data.health;

        // --- BALANCING: Reduced asteroid size ---
        const geometry = new THREE.IcosahedronGeometry(12, 1);
        const positionAttribute = geometry.getAttribute('position');
        for (let i = 0; i < positionAttribute.count; i++) {
            const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
            vertex.multiplyScalar(THREE.MathUtils.randFloat(0.8, 1.5));
            positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        geometry.computeVertexNormals();
        
        const color = this.data.color ? parseInt(this.data.color, 16) : 0x888888;
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            emissive: color,
            emissiveIntensity: 0.05
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.userData.asteroid = this;
        this.mesh.userData.object = this; // For collision manager

        // --- FIX: Rotation speed is now always positive for consistent direction ---
        this.rotationSpeed = new THREE.Vector3(
            Math.random() * 0.005, Math.random() * 0.005, Math.random() * 0.005
        );

        // --- FIX: Add velocity and mass for the collision system ---
        this.velocity = new THREE.Vector3(0, 0, 0); // Asteroids are static
        this.currentMass = this.data.health; // Mass proportional to health

        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();
        this.isDestroyed = false;

        scene.add(this.mesh);
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDestroyed) {
            this.isDestroyed = true;
            if (this.data.resources.itemId) {
                const amountToDrop = THREE.MathUtils.randInt(this.data.resources.amount[0], this.data.resources.amount[1]);
                return {
                    itemId: this.data.resources.itemId,
                    quantity: amountToDrop,
                    position: this.mesh.position.clone()
                };
            }
        }
        return null;
    }

    update(delta) {
        this.mesh.rotation.x += this.rotationSpeed.x;
        this.mesh.rotation.y += this.rotationSpeed.y;
        this.mesh.rotation.z += this.rotationSpeed.z;
        this.boundingBox.setFromObject(this.mesh);
        this.boundingBox.getBoundingSphere(this.boundingSphere);
    }
}