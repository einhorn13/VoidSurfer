// src/EffectsManager.js
import * as THREE from 'three';

class DamageIndicator {
    constructor(scene, position, amount, color) {
        this.scene = scene;
        const canvas = this._createTextCanvas(amount.toString(), color);
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        this.sprite = new THREE.Sprite(material);
        this.sprite.position.copy(position).add(new THREE.Vector3(0, 1, 0));
        this.sprite.scale.set(canvas.width / 32, canvas.height / 32, 1.0);
        this.life = 1.2;
        this.velocity = new THREE.Vector3(0, 2, 0);
        scene.add(this.sprite);
    }
    _createTextCanvas(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 48;
        context.font = `bold ${fontSize}px Arial`;
        const textMetrics = context.measureText(text);
        canvas.width = textMetrics.width;
        canvas.height = fontSize;
        context.font = `bold ${fontSize}px Arial`;
        context.fillStyle = new THREE.Color(color).getStyle();
        context.fillText(text, 0, fontSize - 10);
        return canvas;
    }
    update(delta) {
        this.life -= delta;
        this.sprite.position.add(this.velocity.clone().multiplyScalar(delta));
        this.sprite.material.opacity = Math.max(0, this.life);
    }
    dispose() {
        this.scene.remove(this.sprite);
        this.sprite.material.map.dispose();
        this.sprite.material.dispose();
    }
}

class Explosion {
    constructor(scene, position) {
        this.scene = scene;
        const particleCount = 50;
        const particles = new THREE.BufferGeometry();
        const pMaterial = new THREE.PointsMaterial({
            color: 0xFF8800, size: 0.5, transparent: true, blending: THREE.AdditiveBlending
        });
        const pVertices = [];
        this.velocities = [];
        for (let i = 0; i < particleCount; i++) {
            pVertices.push(0, 0, 0);
            const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            
            if (velocity.lengthSq() > 0) {
                velocity.normalize().multiplyScalar(Math.random() * 15);
            } else {
                velocity.set(1, 0, 0).multiplyScalar(Math.random() * 15);
            }
            this.velocities.push(velocity);
        }
        particles.setAttribute('position', new THREE.Float32BufferAttribute(pVertices, 3));
        this.particleSystem = new THREE.Points(particles, pMaterial);
        this.particleSystem.position.copy(position);
        this.life = 1.0;
        scene.add(this.particleSystem);
    }
    update(delta) {
        this.life -= delta;
        const positions = this.particleSystem.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += this.velocities[i/3].x * delta;
            positions[i+1] += this.velocities[i/3].y * delta;
            positions[i+2] += this.velocities[i/3].z * delta;
        }
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.material.opacity = this.life;
    }
    dispose() {
        this.scene.remove(this.particleSystem);
        this.particleSystem.geometry.dispose();
        this.particleSystem.material.dispose();
    }
}

export class EffectsManager {
    constructor(scene, uiManager) {
        this.scene = scene;
        this.uiManager = uiManager;
        this.activeEffects = [];
    }

    showDamageNumber(position, amount, color) {
        const indicator = new DamageIndicator(this.scene, position, amount, color);
        this.activeEffects.push(indicator);
    }

    createExplosion(position) {
        const explosion = new Explosion(this.scene, position);
        this.activeEffects.push(explosion);
    }
    
    showPlayerDamageEffect() {
        if (this.uiManager) {
            this.uiManager.showDamageFlash();
        }
    }

    // The createSalvage method has been removed. Drop logic is now handled in WorldManager.

    update(delta) {
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.update(delta);
            if (effect.life <= 0) {
                effect.dispose();
                this.activeEffects.splice(i, 1);
            }
        }
    }
}