// Mobile-Optimized Starfield
// Matches desktop visual style with GPU-accelerated animation for mobile performance

class MobileStarfield {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Optimized particle count for mobile (half of desktop)
        this.particleCount = 8000;

        // Mouse tracking
        this.mouse = new THREE.Vector3(0, 0, 0);
        this.mouseSpeed = 0;
        this.lastMousePos = new THREE.Vector2(0, 0);

        this.time = 0;
        this.particles = null;
        this.geometry = null;

        this.init();
    }

    init() {
        this.createStarfield();
        console.log('Mobile Starfield initialized:', this.particleCount, 'particles');
    }

    createStarfield() {
        this.geometry = new THREE.BufferGeometry();

        const positions = new Float32Array(this.particleCount * 3);
        const originalPositions = new Float32Array(this.particleCount * 3);
        const randomSeeds = new Float32Array(this.particleCount);

        // Match desktop distribution: condensed center 50-350 radius
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;

            // Match desktop: condensed center distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 50 + Math.random() * 300; // Same as desktop: 50-350

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            positions[i3 + 0] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;

            originalPositions[i3 + 0] = x;
            originalPositions[i3 + 1] = y;
            originalPositions[i3 + 2] = z;

            randomSeeds[i] = Math.random() * 1000.0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originalPositions, 3));
        this.geometry.setAttribute('randomSeed', new THREE.BufferAttribute(randomSeeds, 1));

        // GPU-accelerated shader material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uMouse: { value: new THREE.Vector3() },
                uMouseSpeed: { value: 0 },
                uCameraPosition: { value: this.camera.position }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(this.geometry, material);
        this.scene.add(this.particles);
    }

    getVertexShader() {
        return `
            uniform float uTime;
            uniform float uPixelRatio;
            uniform vec3 uMouse;
            uniform float uMouseSpeed;
            uniform vec3 uCameraPosition;

            attribute vec3 originalPosition;
            attribute float randomSeed;

            varying float vSpeed;
            varying float vDepth;

            // Simplified 3D noise for mobile
            float hash(float n) {
                return fract(sin(n) * 43758.5453);
            }

            float noise3D(vec3 x) {
                vec3 p = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);

                float n = p.x + p.y * 57.0 + 113.0 * p.z;
                return mix(
                    mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                        mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
            }

            // Simplified curl-like motion for mobile
            vec3 computeFlow(vec3 pos, float time) {
                // Very slow time progression
                float t = time * 0.015 + randomSeed;
                vec3 p = pos * 0.005 + vec3(t, t * 0.8, t * 1.2);

                // Simple flow field
                float n1 = noise3D(p);
                float n2 = noise3D(p + vec3(100.0, 0.0, 0.0));
                float n3 = noise3D(p + vec3(0.0, 100.0, 0.0));

                // Create swirling motion
                vec3 flow = vec3(
                    n2 - n3,
                    n3 - n1,
                    n1 - n2
                );

                return normalize(flow) * 0.5; // Gentle flow
            }

            void main() {
                vec3 pos = originalPosition;

                // Compute flow-based offset
                vec3 flow = computeFlow(originalPosition, uTime);

                // Accumulated displacement over time (clamped for stability)
                float displacement = sin(uTime * 0.3 + randomSeed) * 15.0;
                pos += flow * displacement;

                // Add vortex rotation around center
                float distFromCenter = length(originalPosition);
                vec3 toCenter = -normalize(originalPosition);
                vec3 tangent = normalize(cross(originalPosition, vec3(0.0, 1.0, 0.0)));

                // Vortex strength decreases with distance
                float vortexStrength = smoothstep(350.0, 50.0, distFromCenter) * 20.0;
                float rotation = uTime * 0.02;
                pos += tangent * sin(rotation + randomSeed) * vortexStrength;

                // Gentle mouse interaction
                vec3 toMouse = pos - uMouse;
                float mouseDist = length(toMouse);
                if (mouseDist < 250.0 && mouseDist > 0.1) {
                    float force = (1.0 - mouseDist / 250.0) * uMouseSpeed * 2.0;
                    pos += normalize(toMouse) * force;
                }

                // Calculate speed for glow
                vSpeed = length(flow) * 0.5;

                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mvPosition;

                // Match desktop depth calculation
                float dist = distance(pos, uCameraPosition);
                vDepth = 1.0 - smoothstep(0.0, 400.0, dist);

                // Match desktop size with gentle twinkling
                float baseSize = 1.5 + vDepth * 3.0;
                float twinkle = sin(uTime * 0.5 + originalPosition.x * 0.05 + randomSeed) * 0.15 + 0.85;
                gl_PointSize = baseSize * twinkle * uPixelRatio;
            }
        `;
    }

    getFragmentShader() {
        return `
            varying float vSpeed;
            varying float vDepth;

            void main() {
                // Match desktop circular particle with glow
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);

                if (dist > 0.5) discard;

                // Match desktop glow effect
                float coreGlow = 1.0 - smoothstep(0.0, 0.4, dist);
                float bloom = exp(-dist * 5.0) * 0.7;

                // Very subtle speed-based glow
                float speedGlow = min(vSpeed * 0.3, 0.15);

                // Depth-based opacity
                float alpha = (coreGlow + bloom) * (0.5 + vDepth * 0.5 + speedGlow);

                // Monochromatic white like desktop
                vec3 color = vec3(1.0);
                vec3 finalColor = color * (1.0 + bloom * 1.2);

                gl_FragColor = vec4(finalColor, alpha);
            }
        `;
    }

    updateMouse(mouseX, mouseY) {
        const newMousePos = new THREE.Vector2(mouseX, mouseY);
        this.mouseSpeed = newMousePos.distanceTo(this.lastMousePos);
        this.lastMousePos.copy(newMousePos);

        // Match desktop mouse scaling
        this.mouse.x = mouseX * 50;
        this.mouse.y = mouseY * 50;
        this.mouse.z = 0;
    }

    update(deltaTime) {
        if (!this.particles) return;

        this.time += deltaTime;

        // Decay mouse speed
        this.mouseSpeed *= 0.95;

        // Update shader uniforms (GPU handles all animation)
        if (this.particles.material.uniforms) {
            this.particles.material.uniforms.uTime.value = this.time;
            this.particles.material.uniforms.uMouse.value.copy(this.mouse);
            this.particles.material.uniforms.uMouseSpeed.value = this.mouseSpeed;
            this.particles.material.uniforms.uCameraPosition.value.copy(this.camera.position);
        }
    }

    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.particles && this.particles.material) this.particles.material.dispose();
        if (this.particles) this.scene.remove(this.particles);
    }
}

// Export for use in main.js
window.MobileStarfield = MobileStarfield;
