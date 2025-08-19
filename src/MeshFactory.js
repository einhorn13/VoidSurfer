// src/MeshFactory.js
import * as THREE from 'three';

export class MeshFactory {
    static createShipMesh(shipData, dataManager) {
        if (shipData.proceduralModel) {
            return this._createProceduralShipMesh(shipData.proceduralModel);
        }
        return this._createPlaceholderMesh();
    }

    static _createProceduralShipMesh(modelData) {
        const shipGroup = new THREE.Group();
        const color = parseInt(modelData.color, 16);
        const material = new THREE.MeshStandardMaterial({
            color: color, metalness: 0.8, roughness: 0.5,
            emissive: color, emissiveIntensity: 0.1
        });
        modelData.components.forEach(comp => {
            let geom;
            if (comp.type === 'box') { geom = new THREE.BoxGeometry(...comp.size); }
            if (geom) {
                const part = new THREE.Mesh(geom, material);
                part.position.set(...comp.pos);
                shipGroup.add(part);
            }
        });
        return shipGroup;
    }

    static createAsteroidMesh(asteroidData) {
        const geometry = new THREE.IcosahedronGeometry(12, 2); // Increased detail for smoother deformation
        const color = new THREE.Color(parseInt(asteroidData.color, 16));
        
        const material = new THREE.MeshStandardMaterial({
            color: color, 
            roughness: 0.9, 
            emissive: color, 
            emissiveIntensity: 0.05
        });

        material.instancing = true;

        material.onBeforeCompile = (shader) => {
            // Inject the helper function before main().
            shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                `
                // Simple noise function using a seed
                float noise(vec3 p, float seed) {
                    return sin(p.x * seed) * sin(p.y * seed) * sin(p.z * seed);
                }

                void main() {
                `
            );

            // Inject the displacement logic that uses the function inside main().
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // FIX: Use the static gl_InstanceID as a seed instead of the dynamic instanceMatrix.
                // This makes the deformation unique per instance, but constant over time.
                // Add 1.0 to avoid instance 0 having a seed of 0.0 (which results in no displacement).
                float seed = float(gl_InstanceID) + 1.0;
                float displacement = noise(position * 2.0, seed) * 3.0; // Noise frequency and amplitude
                transformed += normal * displacement;
                `
            );
        };
        
        return new THREE.Mesh(geometry, material);
    }

    static createStationMesh() {
        const group = new THREE.Group();
        const stationMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, metalness: 0.9, roughness: 0.5,
            emissive: 0x445566, emissiveIntensity: 0.2
        });
        group.add(new THREE.Mesh(new THREE.TorusGeometry(120, 15, 16, 100), stationMat));
        group.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 32), stationMat));
        return group;
    }

    static createPlanetMesh(planetData) {
        const geometry = new THREE.SphereGeometry(planetData.size, 32, 16);
        const material = new THREE.MeshStandardMaterial({
            color: parseInt(planetData.color, 16), metalness: 0.1, roughness: 0.8
        });
        return new THREE.Mesh(geometry, material);
    }

    static createSunMesh(sunData) {
        const geometry = new THREE.SphereGeometry(sunData.size, 64, 32);
        const noiseTexture1 = this._createNoiseTexture(128);
        const noiseTexture2 = this._createNoiseTexture(128);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                baseColor: { value: new THREE.Color(parseInt(sunData.color, 16)) },
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
                    vec2 uv1 = vUv + vec2(time * 0.01, time * 0.005);
                    vec2 uv2 = vUv - vec2(time * 0.007, time * 0.012);
                    
                    float noise1 = texture2D(noiseTexture1, uv1).r;
                    float noise2 = texture2D(noiseTexture2, uv2).r;
                    
                    float combinedNoise = noise1 * 0.6 + noise2 * 0.4;
                    
                    float fresnel = 1.0 - dot(normalize(vViewPosition), vNormal);
                    fresnel = pow(fresnel, 2.0);

                    vec3 finalColor = baseColor * (1.0 + combinedNoise * 0.5);
                    finalColor += fresnel * 0.5;

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        });
        return new THREE.Mesh(geometry, material);
    }

    static _createNoiseTexture(size) {
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

    static createItemMesh() {
        const geometry = new THREE.IcosahedronGeometry(0.8, 0);
        const material = new THREE.MeshStandardMaterial({ color: 0xccffcc, emissive: 0x55aa55, metalness: 0.8, roughness: 0.2 });
        return new THREE.Mesh(geometry, material);
    }

    static createSalvageMesh() {
        const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        // Deform the vertices to look like wreckage
        const posAttr = geometry.getAttribute('position');
        for (let i = 0; i < posAttr.count; i++) {
            const vertex = new THREE.Vector3().fromBufferAttribute(posAttr, i);
            vertex.multiplyScalar(THREE.MathUtils.randFloat(0.7, 1.3));
            posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
        }
        geometry.computeVertexNormals();
        const material = new THREE.MeshStandardMaterial({ color: 0x999977, emissive: 0x333311, metalness: 0.9, roughness: 0.7 });
        return new THREE.Mesh(geometry, material);
    }

    static createExplosionMesh(particleCount) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(particleCount * 3), 3));
        const material = new THREE.PointsMaterial({
            color: 0xFF8800, size: 0.5, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
        });
        return new THREE.Points(geometry, material);
    }

    static createHullDebrisMesh(color) {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: parseInt(color, 16), emissive: parseInt(color, 16),
            emissiveIntensity: 0.4, roughness: 0.8
        });
        return new THREE.Mesh(geometry, material);
    }

    static createLaserBeamMesh(start, end, color) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: 2, transparent: true });
        return new THREE.Line(geometry, material);
    }

    static createShieldImpactMesh(radius, localImpactPoint) {
        const geometry = new THREE.SphereGeometry(radius * 1.05, 32, 32);
        
        // FIX: New shader material for the wave effect.
        const material = new THREE.ShaderMaterial({
            uniforms: {
                progress: { value: 0.0 },
                color: { value: new THREE.Color(0x00aaff) },
                impactPoint: { value: localImpactPoint }
            },
            vertexShader: `
                varying vec3 vPosition;
                void main() {
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float progress;
                uniform vec3 color;
                uniform vec3 impactPoint;
                varying vec3 vPosition;

                void main() {
                    float dist = distance(vPosition, impactPoint);
                    
                    float waveWidth = 3.0; // How wide the ripple is
                    float waveSpeed = 80.0; // How fast it expands
                    
                    // Calculate the position of the wave's crest
                    float crestPosition = progress * waveSpeed;

                    // Calculate intensity based on distance from the crest
                    float intensity = smoothstep(crestPosition + waveWidth, crestPosition, dist) - 
                                      smoothstep(crestPosition, crestPosition - waveWidth, dist);
                    intensity = max(0.0, intensity);
                    
                    // Fade out the entire effect over time
                    float fade = pow(1.0 - progress, 2.0);

                    gl_FragColor = vec4(color, intensity * fade * 0.9);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.FrontSide
        });
        return new THREE.Mesh(geometry, material);
    }

    static _createPlaceholderMesh() {
        const geometry = new THREE.BoxGeometry(2, 2, 4);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        return new THREE.Mesh(geometry, material);
    }
}