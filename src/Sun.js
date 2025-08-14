import * as THREE from 'three';

/**
 * Represents the star in the system, with an animated shader material.
 */
export class Sun {
    constructor(scene, sunData) {
        this.data = sunData;
        this.time = 0;

        const geometry = new THREE.SphereGeometry(this.data.size, 64, 32);
        
        // --- PERFORMANCE: Generate small noise textures once, then scroll UVs in shader.
        // This is much cheaper than calculating noise per-pixel every frame.
        const noiseTexture1 = this._createNoiseTexture(128);
        const noiseTexture2 = this._createNoiseTexture(128);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                baseColor: { value: new THREE.Color(parseInt(this.data.color, 16)) },
                noiseTexture1: { value: noiseTexture1 },
                noiseTexture2: { value: noiseTexture2 },
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 baseColor;
                uniform sampler2D noiseTexture1;
                uniform sampler2D noiseTexture2;
                
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    // --- PERFORMANCE: Scroll two textures at different speeds for a complex, non-repeating look.
                    vec2 uv1 = vUv + vec2(time * 0.01, time * 0.005);
                    vec2 uv2 = vUv - vec2(time * 0.007, time * 0.012);
                    
                    float noise1 = texture2D(noiseTexture1, uv1).r;
                    float noise2 = texture2D(noiseTexture2, uv2).r;
                    
                    // Combine noise layers to create the "boiling" surface effect
                    float combinedNoise = noise1 * 0.6 + noise2 * 0.4;
                    
                    // Fresnel effect to make the edges glow brighter (limb darkening/brightening)
                    float fresnel = 1.0 - dot(normalize(vViewPosition), vNormal);
                    fresnel = pow(fresnel, 2.0);

                    // Final color combines base color, noise, and fresnel
                    vec3 finalColor = baseColor * (1.0 + combinedNoise * 0.5);
                    finalColor += fresnel * 0.5;

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(...this.data.position);
        
        // --- NEW: Add userData for collision identification and compute bounding sphere ---
        this.mesh.userData.object = this;
        this.boundingSphere = new THREE.Sphere(this.mesh.position, this.data.size);

        scene.add(this.mesh);
    }

    /**
     * Generates a procedural grayscale noise texture on a canvas.
     * This avoids needing external asset files.
     */
    _createNoiseTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const value = Math.floor(Math.random() * 255);
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
            data[i + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    update(delta) {
        this.time += delta;
        this.mesh.material.uniforms.time.value = this.time;
    }
}