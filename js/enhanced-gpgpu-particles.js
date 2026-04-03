// Enhanced GPGPU Particle System with Visual Depth Layers
// Adds narrative depth through multi-layered particle behaviors

class EnhancedGPGPUParticles {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Create multiple particle layers for depth
        this.layers = [
            {
                name: 'foreground',
                count: 15000,
                baseRadius: 30,
                maxRadius: 200,
                flowSpeed: 0.02,
                curlStrength: 0.08,
                color: new THREE.Color(1.0, 1.0, 1.0),
                brightness: 1.2,
                size: { min: 2.0, max: 5.0 }
            },
            {
                name: 'midground',
                count: 25000,
                baseRadius: 200,
                maxRadius: 500,
                flowSpeed: 0.015,
                curlStrength: 0.05,
                color: new THREE.Color(0.8, 0.9, 1.0),
                brightness: 0.8,
                size: { min: 1.5, max: 3.5 }
            },
            {
                name: 'background',
                count: 10000,
                baseRadius: 500,
                maxRadius: 1000,
                flowSpeed: 0.008,
                curlStrength: 0.03,
                color: new THREE.Color(0.6, 0.7, 0.9),
                brightness: 0.4,
                size: { min: 1.0, max: 2.0 }
            }
        ];

        this.particleSystems = [];
        this.time = 0;
        this.mouse = new THREE.Vector3(0, 0, 0);
        this.mouseSpeed = 0;
        this.lastMousePos = new THREE.Vector2(0, 0);

        this.init();
    }

    init() {
        if (!THREE.GPUComputationRenderer) {
            console.error('GPUComputationRenderer not available');
            return;
        }

        // Initialize each layer
        this.layers.forEach((layerConfig, index) => {
            const system = this.createParticleLayer(layerConfig, index);
            if (system) {
                this.particleSystems.push(system);
            }
        });

        console.log(`Enhanced GPGPU Particles initialized: ${this.particleSystems.length} layers`);
    }

    createParticleLayer(config, layerIndex) {
        const textureSize = Math.ceil(Math.sqrt(config.count));

        // Initialize GPGPU for this layer
        const gpuCompute = new THREE.GPUComputationRenderer(
            textureSize,
            textureSize,
            this.renderer
        );

        if (this.renderer.capabilities.isWebGL2 === false) {
            gpuCompute.setDataType(THREE.HalfFloatType);
        }

        // Create textures
        const dtPosition = gpuCompute.createTexture();
        const dtVelocity = gpuCompute.createTexture();

        this.fillTextures(dtPosition, dtVelocity, config);

        // Create shader variables
        const velocityVariable = gpuCompute.addVariable(
            'textureVelocity',
            this.getLayeredVelocityShader(config),
            dtVelocity
        );

        const positionVariable = gpuCompute.addVariable(
            'texturePosition',
            this.getLayeredPositionShader(),
            dtPosition
        );

        // Set dependencies
        gpuCompute.setVariableDependencies(velocityVariable, [
            positionVariable,
            velocityVariable
        ]);

        gpuCompute.setVariableDependencies(positionVariable, [
            positionVariable,
            velocityVariable
        ]);

        // Add uniforms
        velocityVariable.material.uniforms.uTime = { value: 0.0 };
        velocityVariable.material.uniforms.uMouse = { value: new THREE.Vector3() };
        velocityVariable.material.uniforms.uMouseSpeed = { value: 0.0 };
        velocityVariable.material.uniforms.uFlowSpeed = { value: config.flowSpeed };
        velocityVariable.material.uniforms.uCurlStrength = { value: config.curlStrength };
        velocityVariable.material.uniforms.uLayerDepth = { value: layerIndex / this.layers.length };

        // Initialize
        const error = gpuCompute.init();
        if (error !== null) {
            console.error('GPUComputationRenderer error:', error);
            return null;
        }

        // Create particle mesh
        const particles = this.createParticleMesh(config, textureSize);
        this.scene.add(particles);

        return {
            config,
            gpuCompute,
            velocityVariable,
            positionVariable,
            particles,
            textureSize
        };
    }

    fillTextures(positionTexture, velocityTexture, config) {
        const posArray = positionTexture.image.data;
        const velArray = velocityTexture.image.data;

        for (let i = 0; i < posArray.length; i += 4) {
            // Distribute particles in spherical shell for this layer
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = config.baseRadius + Math.random() * (config.maxRadius - config.baseRadius);

            posArray[i + 0] = radius * Math.sin(phi) * Math.cos(theta);
            posArray[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            posArray[i + 2] = radius * Math.cos(phi);
            posArray[i + 3] = radius; // Store original radius

            // Zero initial velocity
            velArray[i + 0] = 0.0;
            velArray[i + 1] = 0.0;
            velArray[i + 2] = 0.0;
            velArray[i + 3] = 0.0;
        }
    }

    getLayeredVelocityShader(config) {
        return `
            uniform float uTime;
            uniform vec3 uMouse;
            uniform float uMouseSpeed;
            uniform float uFlowSpeed;
            uniform float uCurlStrength;
            uniform float uLayerDepth;

            // 3D Simplex noise
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

            // Layered curl noise with depth variation
            vec3 computeCurl(vec3 p, float time, float layerDepth) {
                const float eps = 0.5;

                // Layer-specific time offset for different flow speeds
                vec3 timeOffset = vec3(
                    time * uFlowSpeed,
                    time * uFlowSpeed * 0.8,
                    time * uFlowSpeed * 1.2
                );

                // Scale based on layer depth
                float scale = 0.003 + layerDepth * 0.002;
                p = p * scale + timeOffset;

                // Compute curl
                float dx = snoise(p + vec3(eps, 0, 0)) - snoise(p - vec3(eps, 0, 0));
                float dy = snoise(p + vec3(0, eps, 0)) - snoise(p - vec3(0, eps, 0));
                float dz = snoise(p + vec3(0, 0, eps)) - snoise(p - vec3(0, 0, eps));
                vec3 noiseGrad0 = vec3(dx, dy, dz) / (2.0 * eps);

                p += 500.0 + layerDepth * 200.0;

                dx = snoise(p + vec3(eps, 0, 0)) - snoise(p - vec3(eps, 0, 0));
                dy = snoise(p + vec3(0, eps, 0)) - snoise(p - vec3(0, eps, 0));
                dz = snoise(p + vec3(0, 0, eps)) - snoise(p - vec3(0, 0, eps));
                vec3 noiseGrad1 = vec3(dx, dy, dz) / (2.0 * eps);

                vec3 curl = cross(noiseGrad0, noiseGrad1);
                float mag = length(curl);
                if (mag > 0.0001) {
                    curl = normalize(curl) * min(mag, 1.0);
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

                // Layer-specific damping
                vel *= 0.92 + uLayerDepth * 0.04;

                // Apply curl noise
                vec3 curl = computeCurl(pos, uTime, uLayerDepth);
                vel += curl * uCurlStrength;

                // Rotational vortex (stronger in foreground)
                float distFromCenter = length(pos);
                vec3 tangent = normalize(cross(pos, vec3(0.0, 1.0, 0.0)));
                float vortexStrength = (1.0 - uLayerDepth) * 0.01;
                vel += tangent * vortexStrength;

                // Gentle spring back to shell
                vec3 originalPos = normalize(pos) * originalRadius;
                vel += (originalPos - pos) * 0.0001;

                // Mouse interaction (stronger in foreground)
                vec3 toMouse = pos - uMouse;
                float mouseDist = length(toMouse);
                float interactionRadius = 200.0 + uLayerDepth * 100.0;
                if (mouseDist < interactionRadius && mouseDist > 0.1) {
                    float force = (1.0 - mouseDist / interactionRadius) * uMouseSpeed * (3.0 - uLayerDepth * 2.0);
                    vel += normalize(toMouse) * force;
                }

                float speed = length(vel);
                gl_FragColor = vec4(vel, speed);
            }
        `;
    }

    getLayeredPositionShader() {
        return `
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 tmpPos = texture2D(texturePosition, uv);
                vec3 pos = tmpPos.xyz;
                vec4 tmpVel = texture2D(textureVelocity, uv);
                vec3 vel = tmpVel.xyz;

                pos += vel * 0.4;

                gl_FragColor = vec4(pos, tmpPos.w);
            }
        `;
    }

    createParticleMesh(config, textureSize) {
        const particleCount = config.count;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const uvs = new Float32Array(particleCount * 2);

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const i2 = i * 2;

            positions[i3] = 0;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = 0;

            uvs[i2] = (i % textureSize) / textureSize;
            uvs[i2 + 1] = Math.floor(i / textureSize) / textureSize;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('reference', new THREE.BufferAttribute(uvs, 2));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uPositions: { value: null },
                uVelocities: { value: null },
                uTime: { value: 0 },
                uCameraPosition: { value: this.camera.position },
                uColor: { value: config.color },
                uBrightness: { value: config.brightness },
                uMinSize: { value: config.size.min },
                uMaxSize: { value: config.size.max }
            },
            vertexShader: `
                uniform sampler2D uPositions;
                uniform sampler2D uVelocities;
                uniform float uTime;
                uniform vec3 uCameraPosition;
                uniform float uMinSize;
                uniform float uMaxSize;

                attribute vec2 reference;

                varying float vSpeed;
                varying float vDepth;

                void main() {
                    vec4 positionData = texture2D(uPositions, reference);
                    vec4 velocityData = texture2D(uVelocities, reference);

                    vec3 pos = positionData.xyz;
                    float speed = velocityData.w;

                    vSpeed = speed;

                    // Depth calculation for parallax effect
                    float dist = distance(pos, uCameraPosition);
                    vDepth = 1.0 - smoothstep(0.0, 800.0, dist);

                    // Size based on depth and speed
                    float baseSize = uMinSize + vDepth * (uMaxSize - uMinSize);
                    float speedBoost = 1.0 + min(speed * 0.3, 0.5);
                    gl_PointSize = baseSize * speedBoost;

                    // Subtle twinkling
                    float twinkle = sin(uTime * 0.3 + pos.x * 0.03) * 0.2 + 0.8;
                    gl_PointSize *= twinkle;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uBrightness;

                varying float vSpeed;
                varying float vDepth;

                void main() {
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);

                    if (dist > 0.5) discard;

                    // Soft particle with glow
                    float coreGlow = 1.0 - smoothstep(0.0, 0.4, dist);
                    float bloom = exp(-dist * 4.0) * 0.8;

                    // Velocity-based brightness boost
                    float speedGlow = min(vSpeed * 0.4, 0.3);

                    // Combined opacity
                    float alpha = (coreGlow + bloom) * (0.3 + vDepth * 0.5 + speedGlow) * uBrightness;

                    // Color with bloom
                    vec3 finalColor = uColor * (1.0 + bloom * 1.5 + speedGlow * 2.0);

                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return new THREE.Points(geometry, material);
    }

    updateMouse(mouseX, mouseY) {
        const newMousePos = new THREE.Vector2(mouseX, mouseY);
        this.mouseSpeed = newMousePos.distanceTo(this.lastMousePos);
        this.lastMousePos.copy(newMousePos);

        this.mouse.x = mouseX * 50;
        this.mouse.y = mouseY * 50;
        this.mouse.z = 0;
    }

    update(time) {
        this.time = time;
        this.mouseSpeed *= 0.95;

        this.particleSystems.forEach(system => {
            // Update GPGPU uniforms
            system.velocityVariable.material.uniforms.uTime.value = time;
            system.velocityVariable.material.uniforms.uMouse.value = this.mouse;
            system.velocityVariable.material.uniforms.uMouseSpeed.value = this.mouseSpeed;

            // Compute
            system.gpuCompute.compute();

            // Update particle material
            system.particles.material.uniforms.uPositions.value =
                system.gpuCompute.getCurrentRenderTarget(system.positionVariable).texture;
            system.particles.material.uniforms.uVelocities.value =
                system.gpuCompute.getCurrentRenderTarget(system.velocityVariable).texture;
            system.particles.material.uniforms.uTime.value = time;
            system.particles.material.uniforms.uCameraPosition.value = this.camera.position;
        });
    }

    dispose() {
        this.particleSystems.forEach(system => {
            if (system.particles) {
                system.particles.geometry.dispose();
                system.particles.material.dispose();
                this.scene.remove(system.particles);
            }
        });
        this.particleSystems = [];
    }
}

// Export
window.EnhancedGPGPUParticles = EnhancedGPGPUParticles;
