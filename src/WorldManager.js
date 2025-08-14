import * as THREE from 'three';
import { Ship } from './Ship.js';
import { EnemyAI } from './EnemyAI.js';
import { Asteroid } from './Asteroid.js';
import { SpatialGrid } from './SpatialGrid.js';
import { SpaceStation } from './SpaceStation.js';
import { DynamicSpawner } from './DynamicSpawner.js';
import { Sun } from './Sun.js';
import { Planet } from './Planet.js';
import { CollisionManager } from './CollisionManager.js';

export class WorldManager {
    constructor(scene, projectileManager, effectsManager, gameStateManager, dataManager) {
        this.scene = scene;
        this.projectileManager = projectileManager;
        this.effectsManager = effectsManager;
        this.gameStateManager = gameStateManager;
        this.dataManager = dataManager;

        this.playerShip = null;
        this.allShips = [];
        this.enemyAIs = [];
        this.asteroids = [];
        this.items = [];
        this.spaceStation = null;
        this.sun = null;
        this.celestialBodies = []; // For collision with planets/sun

        this.spatialGrid = new SpatialGrid();
        this.spawner = new DynamicSpawner(this, this.dataManager.getConfig('spawn_config'));
        this.collisionManager = new CollisionManager(this.spatialGrid, this.effectsManager); // --- NEW

        this.respawnTimer = -1;
    }

    initWorld() {
        this.initCelestialBodies();
        this.spawnInitialEnemies();
        this.spawnAsteroidField();
        this.spaceStation = new SpaceStation(this.scene, new THREE.Vector3(800, 100, -1500));
    }

    initCelestialBodies() {
        const systemConfig = this.dataManager.getConfig('system_config');
        if (!systemConfig) {
            console.error("System configuration not found!");
            return;
        }

        // Create the sun visual object
        this.sun = new Sun(this.scene, systemConfig.sun);
        this.celestialBodies.push(this.sun);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
        directionalLight.position.set(...systemConfig.sun.position);
        this.scene.add(directionalLight);

        // Create planets and their moons
        systemConfig.planets.forEach(planetData => {
            const planet = new Planet(this.scene, planetData);
            this.celestialBodies.push(planet);
            
            if (planetData.moons) {
                const planetPosition = new THREE.Vector3(...planetData.position);
                planetData.moons.forEach(moonData => {
                    const moonPosition = new THREE.Vector3(...moonData.position).add(planetPosition);
                    const fullMoonData = { ...moonData, position: moonPosition.toArray() };
                    const moon = new Planet(this.scene, fullMoonData);
                    this.celestialBodies.push(moon);
                });
            }
        });
    }

    spawnPlayer() {
        if (this.playerShip) {
            this.removeShip(this.playerShip);
        }
        const playerState = this.gameStateManager.playerState;
        const shipData = this.dataManager.getShipData(playerState.shipId);
        const options = {
            ...shipData,
            isPlayer: true,
            position: new THREE.Vector3(0, 0, 0),
            currentHull: playerState.hull,
            cargo: playerState.cargo,
            ammo: playerState.ammo
        };
        this.playerShip = this.createShip(playerState.shipId, options);
        return this.playerShip;
    }

    spawnInitialEnemies() {
        this.createShip('PIRATE_RAIDER', { position: new THREE.Vector3(0, 5, -150) });
        this.createShip('SCRAPHEAP', { position: new THREE.Vector3(50, -20, -250) });
    }

    spawnAsteroidField() {
        for (let i = 0; i < 30; i++) {
            const pos = new THREE.Vector3(
                THREE.MathUtils.randFloatSpread(1000),
                THREE.MathUtils.randFloatSpread(1000),
                THREE.MathUtils.randFloatSpread(1000)
            ).add(new THREE.Vector3(0, 0, -600));
            const type = Math.random() > 0.3 ? 'ROCK' : 'IRON';
            const asteroidData = this.dataManager.getAsteroidData(type);
            if (asteroidData) {
                this.asteroids.push(new Asteroid(this.scene, type, pos, asteroidData));
            }
        }
    }

    createShip(shipId, options) {
        const baseShipData = this.dataManager.getShipData(shipId);
        if (!baseShipData) {
            console.error(`Failed to create ship: Data not found for ID ${shipId}`);
            return null;
        }
        const shipData = { ...baseShipData, ...options };
        const ship = new Ship(this.scene, shipData, this.effectsManager, this.dataManager);
        
        if (!ship.isPlayer) {
            const relationshipColor = {
                'PIRATE_FACTION': '#ff4444',
                'CIVILIAN_FACTION': '#cccccc',
                'PLAYER_FACTION': '#44ff44'
            };
            const color = relationshipColor[ship.faction] || '#ffff00';
            ship.setHealthBarColor(color);
        }
        
        this.allShips.push(ship);

        if (!ship.isPlayer && ship.faction === 'PIRATE_FACTION') {
            const ai = new EnemyAI(ship, this.projectileManager);
            this.enemyAIs.push(ai);
        }
        return ship;
    }

    spawnItem(itemId, quantity, position) {
        const itemData = this.dataManager.getItemData(itemId);
        if (!itemData || quantity <= 0) return;

        const geom = new THREE.IcosahedronGeometry(0.8, 0);
        const mat = new THREE.MeshStandardMaterial({ color: 0xccffcc, emissive: 0x55aa55 });
        const itemMesh = new THREE.Mesh(geom, mat);
        itemMesh.position.copy(position);
        itemMesh.userData.item = { itemId, quantity };

        this.scene.add(itemMesh);
        this.items.push(itemMesh);
    }

    update(delta) {
        let needsRespawn = false;
        if (this.playerShip && this.playerShip.isDestroyed) {
            if (this.respawnTimer < 0) {
                this.gameStateManager.updatePlayerShipState(this.playerShip);
                this.respawnTimer = 5.0;
            }
            this.respawnTimer -= delta;
            if (this.respawnTimer < 0) {
                needsRespawn = true;
                this.respawnTimer = -1;
            }
        }

        this.cleanupDestroyed();

        // Update object states
        if (this.sun) this.sun.update(delta);
        if (this.spaceStation) this.spaceStation.update(delta);
        this.allShips.forEach(ship => ship.update(delta));
        this.enemyAIs.forEach(ai => ai.update(delta, this.allShips));
        this.asteroids.forEach(asteroid => asteroid.update(delta));
        if (this.playerShip && !this.playerShip.isDestroyed) {
             this.spawner.update(this.playerShip.mesh.position, this.allShips);
        }

        // --- REFACTORED: WorldManager populates the grid, CollisionManager uses it ---
        const collidables = [...this.allShips, ...this.asteroids, this.spaceStation].filter(Boolean);
        this.spatialGrid.clear();
        collidables.forEach(obj => this.spatialGrid.register(obj));
        
        this.projectileManager.update(delta, this.spatialGrid, this);
        this.collisionManager.update(collidables, this.celestialBodies);
        this.checkItemCollection();
        
        return { needsRespawn };
    }

    checkItemCollection() {
        if (!this.playerShip || this.playerShip.isDestroyed) return;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            if (this.playerShip.mesh.position.distanceTo(item.position) < 5) {
                const data = item.userData.item;
                const pickedUp = this.playerShip.addCargo(data.itemId, data.quantity);
                if (pickedUp > 0) {
                    this.scene.remove(item);
                    item.geometry.dispose(); item.material.dispose();
                    this.items.splice(i, 1);
                }
            }
        }
    }

    cleanupDestroyed() {
        this.allShips = this.allShips.filter(ship => {
            if (ship.isDestroyed && !ship.isPlayer) {
                this.handleDrops(ship);
                const aiIndex = this.enemyAIs.findIndex(ai => ai.ship === ship);
                if (aiIndex > -1) this.enemyAIs.splice(aiIndex, 1);
                if (ship.mesh) this.scene.remove(ship.mesh);
                
                if (ship.healthBar) {
                    this.scene.remove(ship.healthBar.sprite);
                    ship.healthBar.texture.dispose();
                    ship.healthBar.sprite.material.dispose();
                }
                return false;
            }
            return !ship.isDestroyed || ship.isPlayer;
        });

        this.asteroids = this.asteroids.filter(a => {
            if (a.isDestroyed) {
                this.effectsManager.createExplosion(a.mesh.position);
                this.scene.remove(a.mesh);
                a.mesh.geometry.dispose();
                a.mesh.material.dispose();
            }
            return !a.isDestroyed;
        });
    }

    handleDrops(ship) {
        const dropTable = ship.data.drops;
        if (!dropTable) return;

        if (dropTable.credits) {
            const amount = THREE.MathUtils.randInt(dropTable.credits[0], dropTable.credits[1]);
            if (amount > 0) {
                this.gameStateManager.addCredits(amount);
            }
        }

        if (dropTable.items) {
            dropTable.items.forEach(itemDrop => {
                if (Math.random() < itemDrop.chance) {
                    const quantity = THREE.MathUtils.randInt(itemDrop.quantity[0], itemDrop.quantity[1]);
                    if (quantity > 0) {
                        this.spawnItem(itemDrop.itemId, quantity, ship.mesh.position);
                    }
                }
            });
        }
    }

    removeShip(ship) {
        const shipIndex = this.allShips.indexOf(ship);
        if (shipIndex > -1) this.allShips.splice(shipIndex, 1);

        const aiIndex = this.enemyAIs.findIndex(ai => ai.ship === ship);
        if (aiIndex > -1) this.enemyAIs.splice(aiIndex, 1);

        if(ship.mesh) this.scene.remove(ship.mesh);
        
        if (ship.healthBar) {
            this.scene.remove(ship.healthBar.sprite);
            ship.healthBar.texture.dispose();
            ship.healthBar.sprite.material.dispose();
        }
    }

    despawnShip(ship) {
        this.removeShip(ship);
    }
}