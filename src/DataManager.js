// src/DataManager.js
import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

export class DataManager {
    constructor() {
        this.ships = new Map();
        this.weapons = new Map();
        this.engines = new Map();
        this.shields = new Map();
        this.items = new Map();
        this.asteroids = new Map();
        this.configs = new Map();
        this.gltfModels = new Map();
        this.miscData = new Map();

        this.loader = new GLTFLoader();
    }

    async loadData(onProgress) {
        console.log("Loading asset manifest...");
        const manifestResponse = await fetch('assets/assets.json');
        const manifest = await manifestResponse.json();
        const totalAssets = manifest.length;
        let loadedAssets = 0;

        const getDir = (path) => path.substring(0, path.indexOf('/'));

        const loadAsset = async (path) => {
            const response = await fetch(`assets/${path}`);
            const data = await response.json();
            
            const dir = getDir(path);
            const store = (map) => map.set(data.id, data);

            switch (dir) {
                case 'ships': store(this.ships); break;
                case 'weapons': store(this.weapons); break;
                case 'engines': store(this.engines); break;
                case 'shields': store(this.shields); break;
                case 'items': store(this.items); break;
                case 'asteroids': store(this.asteroids); break;
                case 'config': this.configs.set(path.split('/').pop().replace('.json', ''), data); break;
                default: console.warn(`Unknown data type for path: ${path}`);
            }

            loadedAssets++;
            if (onProgress) {
                onProgress(loadedAssets / totalAssets);
            }
        };
        
        const allPromises = manifest.map(path => loadAsset(path));
        await Promise.all(allPromises);
        
        this.miscData.set('AMMO_DATA', {
            PROJECTILE: { name: 'Cannon Rounds' },
            MISSILE: { name: 'Homing Missile' },
        });

        console.log("All data loaded successfully!");
    }

    getShipData(id) { return this.ships.get(id); }
    getWeaponData(id) { return this.weapons.get(id); }
    getEngineData(id) { return this.engines.get(id); }
    getShieldData(id) { return this.shields.get(id); }
    getItemData(id) { return this.items.get(id); }
    getAsteroidData(id) { return this.asteroids.get(id); }
    getConfig(id) { return this.configs.get(id); }
    getMiscData(id) { return this.miscData.get(id); }
    getGltfModel(path) { return this.gltfModels.get(path); }
}