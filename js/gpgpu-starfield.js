// GPGPU Starfield - Using Three.js GPUComputationRenderer
// Inspired by Codrops dreamy particle effect

class GPGPUStarfield {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Particle configuration
        this.particleCount = 20000; // Increased for denser center
        this.textureSize = Math.ceil(Math.sqrt(this.particleCount));

        // Mouse tracking
        this.mouse = new THREE.Vector3(0, 0, 0);
        this.mouseSpeed = 0;
        this.lastMousePos = new THREE.Vector2(0, 0);

        this.time = 0;

        this.init();
    }

    init() {
        // Check if GPUComputationRenderer is available
        if (!THREE.GPUComputationRenderer) {
            console.error('GPUComputationRenderer not found. Loading from CDN...');
            this.loadGPUComputationRenderer();
            return;
        }

        this.initGPGPU();
    }

    loadGPUComputationRenderer() {
        // Load GPUComputationRenderer from Three.js examples
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/misc/GPUComputationRenderer.js';
        script.onload = () => {
            console.log('GPUComputationRenderer loaded');
            this.initGPGPU();
        };
        script.onerror = () => {
            console.error('Failed to load GPUComputationRenderer');
        };
        document.head.appendChild(script);
    }

    initGPGPU() {
        // Initialize GPUComputationRenderer
        this.gpuCompute = new THREE.GPUComputationRenderer(
            this.textureSize,
            this.textureSize,
            this.renderer
        );

        // Check for float texture support
        if (this.renderer.capabilities.isWebGL2 === false) {
            this.gpuCompute.setDataType(THREE.HalfFloatType);
        }

        // Create data textures
        const dtPosition = this.gpuCompute.createTexture();
        const dtVelocity = this.gpuCompute.createTexture();

        this.fillTextures(dtPosition, dtVelocity);

        // Create shader variables
        this.velocityVariable = this.gpuCompute.addVariable(
            'textureVelocity',
            this.getVelocityShader(),
            dtVelocity
        );

        this.positionVariable = this.gpuCompute.addVariable(
            'texturePosition',
            this.getPositionShader(),
            dtPosition
        );

        // Set dependencies
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [
            this.positionVariable,
            this.velocityVariable
        ]);

        this.gpuCompute.setVariableDependencies(this.positionVariable, [
            this.positionVariable,
            this.velocityVariable
        ]);

        // Add uniforms
        this.velocityVariable.material.uniforms.uTime = { value: 0.0 };
        this.velocityVariable.material.uniforms.uMouse = { value: new THREE.Vector3() };
        this.velocityVariable.material.uniforms.uMouseSpeed = { value: 0.0 };

        // Initialize
        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error('GPUComputationRenderer error:', error);
        }

        // Create particles
        this.createParticles();

        console.log('GPGPU Starfield initialized:', this.particleCount, 'particles');
    }

    fillTextures(positionTexture, velocityTexture) {
        const posArray = positionTexture.image.data;
        const velArray = velocityTexture.image.data;

        for (let i = 0; i < posArray.length; i += 4) {
            // Initialize particles in condensed center volume
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 50 + Math.random() * 300; // Much more condensed: 50-350 instead of 200-1200

            posArray[i + 0] = radius * Math.sin(phi) * Math.cos(theta);
            posArray[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            posArray[i + 2] = radius * Math.cos(phi);
            posArray[i + 3] = radius; // Store original radius

            // Start with ZERO velocity - let curl noise drive everything
            velArray[i + 0] = 0.0;
            velArray[i + 1] = 0.0;
            velArray[i + 2] = 0.0;
            velArray[i + 3] = 0.0; // Speed
        }
    }

    getVelocityShader() {
        return `
            uniform float uTime;
            uniform vec3 uMouse;
            uniform float uMouseSpeed;

            // 3D Simplex noise function
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

                vec3 i  = floor(v + dot(v, C.yyy));
                vec3 x0 = v - i + dot(i, C.xxx);

                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);

                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy;
                vec3 x3 = x0 - D.yyy;

                i = mod289(i);
                vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

                float n_ = 0.142857142857;
                vec3 ns = n_ * D.wyz - D.xzx;

                vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);

                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);

                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);

                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));

                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);

                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;

                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
            }

            // Curl noise for fluid dynamics
            vec3 computeCurl(vec3 p, float time) {
                const float eps = 0.5; // Larger epsilon for smoother gradients

                // VERY slow-moving flow field
                vec3 timeOffset = vec3(time * 0.015, time * 0.012, time * 0.018);
                p = p * 0.005 + timeOffset; // Medium-scale features for visible swirls

                // First gradient field
                float dx = snoise(p + vec3(eps, 0, 0)) - snoise(p - vec3(eps, 0, 0));
                float dy = snoise(p + vec3(0, eps, 0)) - snoise(p - vec3(0, eps, 0));
                float dz = snoise(p + vec3(0, 0, eps)) - snoise(p - vec3(0, 0, eps));

                vec3 noiseGrad0 = vec3(dx, dy, dz) / (2.0 * eps);

                // Second uncorrelated gradient field
                p += 500.0; // Changed offset

                dx = snoise(p + vec3(eps, 0, 0)) - snoise(p - vec3(eps, 0, 0));
                dy = snoise(p + vec3(0, eps, 0)) - snoise(p - vec3(0, eps, 0));
                dz = snoise(p + vec3(0, 0, eps)) - snoise(p - vec3(0, 0, eps));

                vec3 noiseGrad1 = vec3(dx, dy, dz) / (2.0 * eps);

                // Cross product creates divergence-free flow
                vec3 curl = cross(noiseGrad0, noiseGrad1);

                // Normalize and scale to reasonable magnitude
                float mag = length(curl);
                if (mag > 0.0001) {
                    curl = normalize(curl) * min(mag, 1.0); // Clamp max magnitude
                }

                return curl;
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;

                vec4 tmpPos = texture2D(texturePosition, uv);
                vec3 pos = tmpPos.xyz;
                float originalRadius = tmpPos.w;

                vec4 tmpVel = texture2D(textureVelocity, uv);
                vec3 vel = tmpVel.xyz;

                // Medium damping for fluid motion
                vel *= 0.94;

                // Curl noise - increased for visible swirling
                vec3 curl = computeCurl(pos, uTime);
                vel += curl * 0.05; // Increased from 0.015 for more swirl

                // Add rotational vortex force around center for cohesive swirling
                float distFromCenter = length(pos);
                vec3 toCenter = -normalize(pos);
                vec3 tangent = normalize(cross(pos, vec3(0.0, 1.0, 0.0))); // Perpendicular to radius

                // Stronger vortex near center, weaker at edges
                float vortexStrength = smoothstep(350.0, 50.0, distFromCenter) * 0.02;
                vel += tangent * vortexStrength;

                // Very weak attraction back to original position
                vec3 originalPos = normalize(pos) * originalRadius;
                vec3 toOrigin = originalPos - pos;
                vel += toOrigin * 0.0001;

                // Gentle attraction toward center for cohesion
                vel += toCenter * 0.003 * smoothstep(350.0, 100.0, distFromCenter);

                // Mouse interaction - gentle
                vec3 toMouse = pos - uMouse;
                float mouseDist = length(toMouse);
                if (mouseDist < 250.0 && mouseDist > 0.1) {
                    float force = (1.0 - mouseDist / 250.0) * uMouseSpeed * 3.0;
                    vel += normalize(toMouse) * force;
                }

                // Calculate speed
                float speed = length(vel);

                gl_FragColor = vec4(vel, speed);
            }
        `;
    }

    getPositionShader() {
        return `
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;

                vec4 tmpPos = texture2D(texturePosition, uv);
                vec3 pos = tmpPos.xyz;

                vec4 tmpVel = texture2D(textureVelocity, uv);
                vec3 vel = tmpVel.xyz;

                // Scale down velocity for slower, smoother movement
                pos += vel * 0.3;

                gl_FragColor = vec4(pos, tmpPos.w);
            }
        `;
    }

    createParticles() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const uvs = new Float32Array(this.particleCount * 2);

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            const i2 = i * 2;

            positions[i3] = 0;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = 0;

            uvs[i2] = (i % this.textureSize) / this.textureSize;
            uvs[i2 + 1] = Math.floor(i / this.textureSize) / this.textureSize;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('reference', new THREE.BufferAttribute(uvs, 2));

        // Create shader material for rendering particles
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uPositions: { value: null }, // Will be updated from GPGPU
                uVelocities: { value: null },
                uTime: { value: 0 },
                uCameraPosition: { value: this.camera.position }
            },
            vertexShader: `
                uniform sampler2D uPositions;
                uniform sampler2D uVelocities;
                uniform float uTime;
                uniform vec3 uCameraPosition;

                attribute vec2 reference;

                varying float vSpeed;
                varying float vDepth;

                void main() {
                    vec4 positionData = texture2D(uPositions, reference);
                    vec4 velocityData = texture2D(uVelocities, reference);

                    vec3 pos = positionData.xyz;
                    float speed = velocityData.w;

                    // Pass to fragment shader
                    vSpeed = speed;

                    // Calculate depth for size variation (adjusted for condensed particles)
                    float dist = distance(pos, uCameraPosition);
                    vDepth = 1.0 - smoothstep(0.0, 400.0, dist);

                    // Point size based on depth only (no speed boost for stability)
                    float baseSize = 1.5 + vDepth * 3.0;
                    gl_PointSize = baseSize;

                    // Very gentle twinkling effect
                    float twinkle = sin(uTime * 0.5 + pos.x * 0.05 + pos.y * 0.05) * 0.15 + 0.85;
                    gl_PointSize *= twinkle;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying float vSpeed;
                varying float vDepth;

                void main() {
                    // Circular particle
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);

                    if (dist > 0.5) discard;

                    // Soft glow
                    float coreGlow = 1.0 - smoothstep(0.0, 0.4, dist);
                    float bloom = exp(-dist * 5.0) * 0.7;

                    // Very subtle velocity-based brightness
                    float speedGlow = min(vSpeed * 0.5, 0.2); // Clamp max glow

                    // Depth-based opacity
                    float alpha = (coreGlow + bloom) * (0.5 + vDepth * 0.5 + speedGlow);

                    // Monochromatic white
                    vec3 color = vec3(1.0);
                    vec3 finalColor = color * (1.0 + bloom * 1.2 + speedGlow);

                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    updateMouse(mouseX, mouseY) {
        // Convert screen space to world space
        const newMousePos = new THREE.Vector2(mouseX, mouseY);

        // Calculate mouse speed
        this.mouseSpeed = newMousePos.distanceTo(this.lastMousePos);
        this.lastMousePos.copy(newMousePos);

        // Update 3D mouse position
        this.mouse.x = mouseX * 50;
        this.mouse.y = mouseY * 50;
        this.mouse.z = 0;
    }

    update(time) {
        // Update GPGPU uniforms
        this.velocityVariable.material.uniforms.uTime.value = time;
        this.velocityVariable.material.uniforms.uMouse.value = this.mouse;
        this.velocityVariable.material.uniforms.uMouseSpeed.value = this.mouseSpeed;

        // Decay mouse speed
        this.mouseSpeed *= 0.95;

        // Compute GPGPU (this updates position and velocity textures)
        this.gpuCompute.compute();

        // Get computed textures and pass to particle material
        this.particles.material.uniforms.uPositions.value =
            this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
        this.particles.material.uniforms.uVelocities.value =
            this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture;
        this.particles.material.uniforms.uTime.value = time;
        this.particles.material.uniforms.uCameraPosition.value = this.camera.position;
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
window.GPGPUStarfield = GPGPUStarfield;
