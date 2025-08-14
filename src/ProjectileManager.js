// src/ProjectileManager.js
import * as THREE from 'three';

class Projectile {
    constructor(scene, originShip, weaponData) {
        this.faction = originShip.faction;
        this.damage = weaponData.damage;
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 1);
        
        // --- FIX: Parse the color string from JSON into a number ---
        const colorValue = weaponData.color ? parseInt(weaponData.color, 16) : 0xffffff;
        const material = new THREE.MeshBasicMaterial({ color: colorValue });

        this.mesh = new THREE.Mesh(geometry, material);
        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(originShip.mesh.quaternion);
        this.mesh.position.copy(originShip.mesh.position).add(forward.clone().multiplyScalar(2.0));
        this.mesh.quaternion.copy(originShip.mesh.quaternion);

        this.velocity = new THREE.Vector3().copy(forward).multiplyScalar(weaponData.speed).add(originShip.velocity);
        this.life = 2.5;
        this.previousPosition = this.mesh.position.clone();

        scene.add(this.mesh);
    }
    update(delta) {
        this.previousPosition.copy(this.mesh.position);
        this.life -= delta;
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));
        this.boundingBox.setFromObject(this.mesh);
        this.boundingBox.getBoundingSphere(this.boundingSphere);
    }
}

class HomingMissile {
    constructor(scene, originShip, weapon, target) {
        this.faction = originShip.faction;
        this.target = target;
        this.damage = weapon.damage;

        const geometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xffdddd, emissive: 0xff2222 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.boundingBox = new THREE.Box3();
        this.boundingSphere = new THREE.Sphere();

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(originShip.mesh.quaternion);
        this.mesh.position.copy(originShip.mesh.position).add(forward.clone().multiplyScalar(3.0));
        this.mesh.quaternion.copy(originShip.mesh.quaternion);

        this.velocity = originShip.velocity.clone().add(forward.multiplyScalar(30));
        this.life = 15;
        this.turnRate = 1.5;
        this.maxSpeed = 80;
        this.acceleration = 1.5;

        this.previousPosition = this.mesh.position.clone();
        scene.add(this.mesh);
    }

    update(delta) {
        this.previousPosition.copy(this.mesh.position);
        this.life -= delta;

        if (this.target && !this.target.isDestroyed) {
            const directionToTarget = new THREE.Vector3().subVectors(this.target.mesh.position, this.mesh.position).normalize();
            const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), directionToTarget);
            this.mesh.quaternion.slerp(targetQuaternion, this.turnRate * delta);
        } else {
            this.target = null;
        }

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        const targetVelocity = forward.multiplyScalar(this.maxSpeed);
        this.velocity.lerp(targetVelocity, this.acceleration * delta);

        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));
        this.boundingBox.setFromObject(this.mesh);
        this.boundingBox.getBoundingSphere(this.boundingSphere);
    }
}

export class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = [];
        this.raycaster = new THREE.Raycaster();
        this.raycaster.layers.set(0);
    }

    fire(originShip, weapon, target = null) {
        if (weapon.type === 'HOMING' && target) {
            const missile = new HomingMissile(this.scene, originShip, weapon, target);
            this.projectiles.push(missile);
        } else if (weapon.type === 'PROJECTILE' || weapon.type === 'LASER') {
            const proj = new Projectile(this.scene, originShip, weapon);
            this.projectiles.push(proj);
        }
    }

    update(delta, spatialGrid, worldManager) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(delta);
            let hit = false;

            const direction = new THREE.Vector3().subVectors(proj.mesh.position, proj.previousPosition);
            const distance = direction.length();
            if (distance === 0) continue;
            direction.normalize();

            this.raycaster.set(proj.previousPosition, direction);
            this.raycaster.far = distance;

            const potentialTargets = spatialGrid.getNearby(proj)
                .filter(t => (t.faction !== proj.faction || !t.faction) && !t.isDestroyed && proj.boundingSphere.intersectsSphere(t.boundingSphere));

            const targetMeshes = potentialTargets.map(t => t.mesh);
            if (targetMeshes.length === 0) {
                 if (proj.life <= 0) {
                    this.scene.remove(proj.mesh);
                    proj.mesh.geometry.dispose();
                    proj.mesh.material.dispose();
                    this.projectiles.splice(i, 1);
                }
                continue;
            }

            const intersects = this.raycaster.intersectObjects(targetMeshes, true);

            if (intersects.length > 0) {
                const firstHit = intersects[0].object;
                let parentObject = firstHit;
                while (parentObject.parent && !parentObject.userData.ship && !parentObject.userData.asteroid) {
                    parentObject = parentObject.parent;
                }

                if (parentObject.userData.ship) {
                    parentObject.userData.ship.takeDamage(proj.damage);
                    hit = true;
                } else if (parentObject.userData.asteroid) {
                    const resources = parentObject.userData.asteroid.takeDamage(proj.damage);
                    if (resources) {
                        worldManager.spawnItem(resources.itemId, resources.quantity, resources.position);
                    }
                    hit = true;
                }
            }

            if (proj.life <= 0 || hit) {
                if (hit) { worldManager.effectsManager.createExplosion(proj.mesh.position); }
                this.scene.remove(proj.mesh);
                proj.mesh.geometry.dispose();
                proj.mesh.material.dispose();
                this.projectiles.splice(i, 1);
            }
        }
    }
}