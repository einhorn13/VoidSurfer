import * as THREE from 'three';

export class ShipMeshFactory {
    static createMesh(shipData, dataManager) {
        if (shipData.modelPath) {
            const model = dataManager.getGltfModel(shipData.modelPath);
            if (model) {
                return model.clone();
            }
            console.warn(`GLTF model not found for path: ${shipData.modelPath}. Using fallback.`);
        }

        if (shipData.proceduralModel) {
            return this._createProceduralMesh(shipData.proceduralModel);
        }

        console.error(`No model definition found for ship: ${shipData.id}. Using placeholder.`);
        return this._createPlaceholderMesh();
    }

    static _createProceduralMesh(modelData) {
        const shipGroup = new THREE.Group();
        const color = parseInt(modelData.color, 16);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.8,
            // --- FIX: Increased roughness to diffuse reflections and add volume.
            roughness: 0.5,
            emissive: color,
            emissiveIntensity: 0.1
        });

        modelData.components.forEach(comp => {
            let geom;
            if (comp.type === 'box') {
                geom = new THREE.BoxGeometry(...comp.size);
            }
            if (geom) {
                const part = new THREE.Mesh(geom, material);
                part.position.set(...comp.pos);
                shipGroup.add(part);
            }
        });
        return shipGroup;
    }

    static _createPlaceholderMesh() {
        const geometry = new THREE.BoxGeometry(2, 2, 4);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        return new THREE.Mesh(geometry, material);
    }
}