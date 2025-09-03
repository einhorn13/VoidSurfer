// src/components/EngineTrail.js
import * as THREE from 'three';

const MAX_PARTICLES = 200;
const PARTICLE_LIFETIME = 0.8;

class Particle {
    constructor() {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.age = 0;
        this.life = 1;
        this.isActive = false;
    }

    init(originPosition, shipVelocity, shipQuaternion, radius) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipQuaternion);
        const back = forward.clone().negate();
        
        // Position the particle just behind the ship's bounding sphere
        this.position.copy(originPosition).add(back.multiplyScalar(radius * 1.1));
        
        const exhaustVel = forward.multiplyScalar(-15); // Push particles away from the back
        this.velocity.copy(shipVelocity).add(exhaustVel);

        this.age = 0;
        this.life = Math.random() * PARTICLE_LIFETIME;
        this.isActive = true;
    }
}

export class EngineTrail {
    constructor(scene) {
        this.scene = scene;
        this.particlePool = [];
        this.nextParticleIndex = 0;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(MAX_PARTICLES * 3);
        const colors = new Float32Array(MAX_PARTICLES * 3);
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

        const material = new THREE.PointsMaterial({
            size: 0.25,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });

        this.points = new THREE.Points(geometry, material);
        this.points.frustumCulled = false;
        this.scene.add(this.points);

        for (let i = 0; i < MAX_PARTICLES; i++) {
            this.particlePool.push(new Particle());
        }

        this.emissionRate = 0;
        this.emissionCounter = 0;
        this.isStopped = false;
    }

    stop() {
        this.isStopped = true;
    }

    update(delta, ship) {
        this.emissionRate = 0;
        if (!this.isStopped) {
            if (ship.isAccelerating) {
                this.emissionRate = 30;
            }
            if (ship.boostMultiplier > 1.0) {
                this.emissionRate = 90;
            }
        }

        if (this.emissionRate > 0) {
            this.emissionCounter += this.emissionRate * delta;
            const particlesToSpawn = Math.floor(this.emissionCounter);
            this.emissionCounter -= particlesToSpawn;

            for (let i = 0; i < particlesToSpawn; i++) {
                if (this.particlePool.length === 0) break;
                const particle = this.particlePool[this.nextParticleIndex];
                particle.init(ship.transform.position, ship.velocity, ship.transform.rotation, ship.radius);
                this.nextParticleIndex = (this.nextParticleIndex + 1) % MAX_PARTICLES;
            }
        }
        
        let activeParticleCount = 0;
        const positions = this.points.geometry.attributes.position.array;
        const colors = this.points.geometry.attributes.color.array;

        for (const p of this.particlePool) {
            if (!p.isActive) continue;

            p.age += delta;
            if (p.age >= p.life) {
                p.isActive = false;
                continue;
            }

            p.position.add(p.velocity.clone().multiplyScalar(delta));
            
            positions[activeParticleCount * 3] = p.position.x;
            positions[activeParticleCount * 3 + 1] = p.position.y;
            positions[activeParticleCount * 3 + 2] = p.position.z;

            const lifePercent = p.age / p.life;
            const alpha = 1.0 - lifePercent;
            const color = new THREE.Color(0x87ceeb).lerp(new THREE.Color(0x001133), lifePercent);
            
            colors[activeParticleCount * 3] = color.r * alpha;
            colors[activeParticleCount * 3 + 1] = color.g * alpha;
            colors[activeParticleCount * 3 + 2] = color.b * alpha;

            activeParticleCount++;
        }
        
        this.points.visible = activeParticleCount > 0;
        
        this.points.geometry.setDrawRange(0, activeParticleCount);
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
    }

    dispose() {
        this.scene.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.dispose();
        this.particlePool = [];
    }
}