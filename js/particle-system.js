// Advanced Particle System with Turbulence, Mouse Control, and Bloom
class ParticleSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.particles = null;
        this.particleCount = 20000;
        this.mouse = { x: 0, y: 0 };
        this.time = 0;
        this.turbulence = { x: 0, y: 0, z: 0 };

        // Shader-based particle system
        this.initShaderParticles();
    }

    initShaderParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const velocities = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);
        const phases = new Float32Array(this.particleCount);

        // Initialize particle data inspired by the Shadertoy fractal and root functions
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;

            // Create a 3D fractal-inspired distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = Math.pow(Math.random(), 0.5) * 150;

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi) - 100;

            // Initial velocities
            velocities[i3] = (Math.random() - 0.5) * 0.1;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.1;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;

            // Monochromatic white gradient
            const brightness = 0.7 + Math.random() * 0.3; // 0.7 to 1.0
            colors[i3] = brightness;
            colors[i3 + 1] = brightness;
            colors[i3 + 2] = brightness;

            sizes[i] = Math.random() * 3 + 1;
            phases[i] = Math.random() * Math.PI * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

        // Custom shader material with glow and turbulence
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                mousePos: { value: new THREE.Vector3(0, 0, 0) },
                turbulence: { value: new THREE.Vector3(0, 0, 0) },
                cameraPos: { value: this.camera.position }
            },
            vertexShader: `
                attribute vec3 velocity;
                attribute vec3 color;
                attribute float size;
                attribute float phase;

                uniform float time;
                uniform vec3 mousePos;
                uniform vec3 turbulence;
                uniform vec3 cameraPos;

                varying vec3 vColor;
                varying float vIntensity;

                // Fractal-inspired noise function from Shadertoy
                vec3 hash3(vec3 p) {
                    p = vec3(
                        dot(p, vec3(127.1, 311.7, 74.7)),
                        dot(p, vec3(269.5, 183.3, 246.1)),
                        dot(p, vec3(113.5, 271.9, 124.6))
                    );
                    return fract(sin(p) * 43758.5453123);
                }

                float noise(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);

                    return mix(
                        mix(
                            mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                                dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
                            mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                                dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x), f.y),
                        mix(
                            mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                                dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
                            mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                                dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x), f.y), f.z);
                }

                // Turbulent flow field
                vec3 curl(vec3 p, float t) {
                    float e = 0.1;
                    vec3 p1 = p + vec3(e, 0, 0);
                    vec3 p2 = p - vec3(e, 0, 0);
                    vec3 p3 = p + vec3(0, e, 0);
                    vec3 p4 = p - vec3(0, e, 0);
                    vec3 p5 = p + vec3(0, 0, e);
                    vec3 p6 = p - vec3(0, 0, e);

                    float n1 = noise(p1 + t);
                    float n2 = noise(p2 + t);
                    float n3 = noise(p3 + t);
                    float n4 = noise(p4 + t);
                    float n5 = noise(p5 + t);
                    float n6 = noise(p6 + t);

                    return vec3(
                        (n3 - n4) - (n5 - n6),
                        (n5 - n6) - (n1 - n2),
                        (n1 - n2) - (n3 - n4)
                    ) / (2.0 * e);
                }

                void main() {
                    vec3 pos = position;

                    // Autonomous turbulent flow - always active
                    vec3 turbFlow = curl(pos * 0.015, time * 0.08) * 3.5;
                    pos += turbFlow;

                    // Add audio reactive turbulence on top
                    pos += turbFlow * turbulence * 0.5;

                    // Gentle mouse interaction
                    vec3 toMouse = mousePos - pos;
                    float distToMouse = length(toMouse);
                    float mouseInfluence = smoothstep(100.0, 0.0, distToMouse);
                    pos += normalize(toMouse) * mouseInfluence * 1.5;

                    // Very slow autonomous swirling motion
                    float angle = time * 0.08 + length(pos.xy) * 0.005;
                    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
                    pos.xy = rotation * pos.xy;

                    // Autonomous wave motion
                    float wave = sin(pos.z * 0.01 + time * 0.3) * 1.5;
                    pos.x += wave;
                    pos.y += cos(pos.z * 0.01 + time * 0.25) * 1.5;

                    // Subtle pulsing
                    float pulse = sin(time * 2.0 + phase) * 0.3 + 0.7;

                    // Calculate intensity for depth-based glow
                    float distFromCamera = distance(pos, cameraPos);
                    vIntensity = (1.0 - smoothstep(0.0, 250.0, distFromCamera)) * (0.4 + pulse * 0.2);

                    // Monochromatic - no color shifting
                    vColor = color * (1.0 + vIntensity * 1.2);

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * (350.0 / -mvPosition.z) * (0.8 + pulse * 0.4);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vIntensity;

                void main() {
                    // Smooth circular particle
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);

                    if (dist > 0.5) discard;

                    // Soft core with smooth falloff
                    float coreGlow = 1.0 - smoothstep(0.0, 0.4, dist);

                    // Clean bloom
                    float bloom = exp(-dist * 5.0) * 0.6;

                    float alpha = (coreGlow + bloom) * vIntensity * 0.8;

                    vec3 finalColor = vColor * (1.0 + bloom * 1.5);

                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);

        console.log('Shader-based particle system initialized with', this.particleCount, 'particles');
    }

    updateMouse(mouseX, mouseY) {
        this.mouse.x = mouseX;
        this.mouse.y = mouseY;
    }

    update() {
        this.time += 0.016;

        if (this.particles) {
            const material = this.particles.material;

            // Update time uniform
            material.uniforms.time.value = this.time;

            // Update mouse position in 3D space - reduced influence
            const mouseWorld = new THREE.Vector3(
                this.mouse.x * 30,
                this.mouse.y * 30,
                0
            );
            material.uniforms.mousePos.value.copy(mouseWorld);

            // Update turbulence - slower, more elegant
            this.turbulence.x = Math.sin(this.time * 0.2) * 0.3;
            this.turbulence.y = Math.cos(this.time * 0.15) * 0.3;
            this.turbulence.z = Math.sin(this.time * 0.25) * 0.2;
            material.uniforms.turbulence.value.copy(this.turbulence);

            // Update camera position
            material.uniforms.cameraPos.value.copy(this.camera.position);

            // Very subtle rotation for cohesive movement
            this.particles.rotation.y += 0.0001;
            this.particles.rotation.x = Math.sin(this.time * 0.05) * 0.03;
        }
    }

    increaseTurbulence() {
        // Subtle turbulence increase on interaction - more refined
        this.turbulence.x += (Math.random() - 0.5) * 0.8;
        this.turbulence.y += (Math.random() - 0.5) * 0.8;
        this.turbulence.z += (Math.random() - 0.5) * 0.6;
    }

    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.scene.remove(this.particles);
        }
    }
}

// Export for use in main.js
window.ParticleSystem = ParticleSystem;
