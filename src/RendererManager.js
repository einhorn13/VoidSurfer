import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Manages the WebGLRenderer, EffectComposer, and post-processing passes.
 * It also handles window resizing for the main 3D canvas.
 */
export class RendererManager {
    constructor(scene, camera, container) {
        this.scene = scene;
        this.camera = camera;

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        
        this._setupPasses();
        this._addEventListeners();
    }

    _setupPasses() {
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8,  // strength
            0.5,  // radius
            0.85  // threshold
        );
        this.composer.addPass(bloomPass);
    }

    _addEventListeners() {
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();

            this.renderer.setSize(width, height);
            this.composer.setSize(width, height);
        });
    }

    render(delta) {
        this.composer.render(delta);
    }
}