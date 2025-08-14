import * as THREE from 'three';

export class SpaceStation {
    constructor(scene, position) {
        this.position = position;
        this.dockingRadius = 200;
        this.maxDockingSpeed = 5;

        // The main group for the station
        this.mesh = this._createMesh();
        this.mesh.position.copy(this.position);
        
        this.mesh.userData.station = this;
        this.mesh.userData.object = this;
        this.velocity = new THREE.Vector3(0, 0, 0); // Stations don't move
        this.currentMass = 1e9; // Effectively infinite mass

        // --- FIX: Add boundingBox property and correctly compute both bounding volumes ---
        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();
        this.mesh.updateMatrixWorld(true);
        this.boundingBox.setFromObject(this.mesh);
        this.boundingBox.getBoundingSphere(this.boundingSphere);
        
        scene.add(this.mesh);
    }

    _createMesh() {
        const group = new THREE.Group();
        const stationMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            metalness: 0.9, 
            roughness: 0.5,
            emissive: 0x445566,
            emissiveIntensity: 0.2
        });
        
        group.add(new THREE.Mesh(new THREE.TorusGeometry(120, 15, 16, 100), stationMat));
        group.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 32), stationMat));
        
        group.traverse(child => {
            if (child.isMesh) {
                child.layers.enableAll();
            }
        });

        return group;
    }

    canDock(ship) {
        if (!ship || ship.isDestroyed) return false;

        const distance = this.mesh.position.distanceTo(ship.mesh.position);
        const speed = ship.velocity.length();
        
        return distance < this.dockingRadius && speed < this.maxDockingSpeed;
    }

    update(delta) {
        this.mesh.rotation.z += 0.05 * delta;
    }
    
    getScreenPosition(camera) {
        const position = new THREE.Vector3();
        this.mesh.getWorldPosition(position);
        return position.project(camera);
    }
}