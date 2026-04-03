// Procedural Vortex Sphere - Inspired by Codrops Tutorial
// Creates a swirling vortex effect inside a glass sphere

class VortexSphere {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = Object.assign({
            radius: options.radius || 80,
            position: options.position || new THREE.Vector3(0, 150, 0),
            emissionColor: options.emissionColor || new THREE.Color(0x4444ff),
            emissionStrength: options.emissionStrength || 2.5,
            glassThickness: options.glassThickness || 0.4,
            glassIOR: options.glassIOR || 1.5
        }, options);

        this.time = 0;
        this.vortexMesh = null;
        this.glassSphere = null;

        this.init();
    }

    init() {
        // Create inner vortex with custom shader
        this.createVortex();

        // Create outer glass sphere
        this.createGlassSphere();

        console.log('Vortex Sphere initialized at', this.options.position);
    }

    createVortex() {
        // Vortex geometry - sphere subdivided for smooth shading
        const geometry = new THREE.SphereGeometry(this.options.radius * 0.85, 64, 64);

        // Custom shader material for procedural vortex
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uFrequency: { value: 2.5 },
                uDistortion: { value: 0.5 },
                uEmissionColor: { value: this.options.emissionColor },
                uEmissionStrength: { value: this.options.emissionStrength },
                uRotationSpeed: { value: 0.3 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vNormal;

                void main() {
                    vUv = uv;
                    vPosition = position;
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uFrequency;
                uniform float uDistortion;
                uniform vec3 uEmissionColor;
                uniform float uEmissionStrength;
                uniform float uRotationSpeed;

                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vNormal;

                // Pseudo-random hash function
                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + 0.1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }

                // 3D noise function
                float noise(vec3 x) {
                    vec3 i = floor(x);
                    vec3 f = fract(x);
                    f = f * f * (3.0 - 2.0 * f);

                    return mix(
                        mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
                        f.z
                    );
                }

                // Fractal Brownian Motion
                float fbm(vec3 p, int octaves) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    float frequency = 1.0;

                    for (int i = 0; i < 5; i++) {
                        if (i >= octaves) break;
                        value += amplitude * noise(p * frequency);
                        frequency *= 2.0;
                        amplitude *= 0.5;
                    }
                    return value;
                }

                // 2D rotation
                vec2 rotate2D(vec2 v, float angle) {
                    float s = sin(angle);
                    float c = cos(angle);
                    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
                }

                void main() {
                    // Create vortex coordinates
                    vec3 pos = vPosition * 0.01;

                    // Add rotation based on distance from center
                    float dist = length(pos.xy);
                    float angle = -log(dist + 0.1) * 2.0 + uTime * uRotationSpeed;

                    // Apply spiral rotation
                    pos.xy = rotate2D(pos.xy, angle);

                    // Animate position
                    vec3 animatedPos = pos + vec3(0.0, uTime * 0.1, 0.0);

                    // Generate FBM noise for each color channel
                    vec3 noiseColor;
                    noiseColor.r = fbm(animatedPos * uFrequency + vec3(0.0), 5) + uDistortion;
                    noiseColor.g = fbm(animatedPos * uFrequency + vec3(1.0), 5) + uDistortion;
                    noiseColor.b = fbm(animatedPos * uFrequency + vec3(2.0), 5) + uDistortion;

                    // Calculate emission intensity based on noise
                    float noiseLength = length(noiseColor);
                    float emission = (0.8 - noiseLength) * 4.5;
                    emission = max(emission, 0.0);

                    // Apply emission color
                    vec3 finalColor = uEmissionColor * emission * uEmissionStrength;

                    // Add some base color variation
                    finalColor += noiseColor * 0.3;

                    // Fresnel effect for edges
                    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
                    finalColor += fresnel * uEmissionColor * 0.5;

                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            transparent: false
        });

        this.vortexMesh = new THREE.Mesh(geometry, material);
        this.vortexMesh.position.copy(this.options.position);
        this.scene.add(this.vortexMesh);
    }

    createGlassSphere() {
        // Outer glass sphere geometry
        const geometry = new THREE.SphereGeometry(this.options.radius, 64, 64);

        // Physical material for realistic glass
        const material = new THREE.MeshPhysicalMaterial({
            transparent: true,
            opacity: 0.15,
            transmission: 0.95,
            thickness: this.options.glassThickness,
            roughness: 0.0,
            ior: this.options.glassIOR,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.5,
            metalness: 0.0,
            side: THREE.FrontSide
        });

        this.glassSphere = new THREE.Mesh(geometry, material);
        this.glassSphere.position.copy(this.options.position);
        this.scene.add(this.glassSphere);
    }

    update(deltaTime = 0.016) {
        this.time += deltaTime;

        // Update vortex shader time uniform
        if (this.vortexMesh && this.vortexMesh.material.uniforms) {
            this.vortexMesh.material.uniforms.uTime.value = this.time;
        }

        // Subtle rotation of the entire sphere
        if (this.glassSphere) {
            this.glassSphere.rotation.y += 0.001;
        }
        if (this.vortexMesh) {
            this.vortexMesh.rotation.y += 0.002;
        }
    }

    // Update position
    setPosition(x, y, z) {
        const newPos = new THREE.Vector3(x, y, z);
        if (this.vortexMesh) this.vortexMesh.position.copy(newPos);
        if (this.glassSphere) this.glassSphere.position.copy(newPos);
    }

    // Update emission color
    setEmissionColor(color) {
        if (this.vortexMesh && this.vortexMesh.material.uniforms) {
            this.vortexMesh.material.uniforms.uEmissionColor.value.set(color);
        }
    }

    // Update emission strength
    setEmissionStrength(strength) {
        if (this.vortexMesh && this.vortexMesh.material.uniforms) {
            this.vortexMesh.material.uniforms.uEmissionStrength.value = strength;
        }
    }

    // Cleanup
    destroy() {
        if (this.vortexMesh) {
            this.scene.remove(this.vortexMesh);
            this.vortexMesh.geometry.dispose();
            this.vortexMesh.material.dispose();
        }
        if (this.glassSphere) {
            this.scene.remove(this.glassSphere);
            this.glassSphere.geometry.dispose();
            this.glassSphere.material.dispose();
        }
    }
}

// Export for use
window.VortexSphere = VortexSphere;
