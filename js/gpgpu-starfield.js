// GPGPU Starfield - Using Three.js GPUComputationRenderer
// Inspired by Codrops dreamy particle effect
//
// The stars drift as a cloud, gather into named shapes (setFormation), and can gather into a
// picture: setArt() takes one target position and one colour per star, so the cloud becomes a
// coloured point image of an artwork (js/artscene.js builds that data). The pointer pushes stars
// away along the line of sight (setPointerRay).

class GPGPUStarfield {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Particle configuration
        this.particleCount = 20000; // Increased for denser center
        this.textureSize = Math.ceil(Math.sqrt(this.particleCount));

        // Pointer: a ray from the camera through the cursor, and how fast the cursor is moving
        this.rayOrigin = new THREE.Vector3(0, 0, 1000);
        this.rayDir = new THREE.Vector3(0, 0, -1);
        this.pointerOn = 0;
        this.mouseSpeed = 0;
        this.lastMousePos = new THREE.Vector2(0, 0);

        // How hard a held star is pulled to its place, and how much speed it keeps each frame.
        // Pictures use a stiffer, more damped pull than the loose shapes so they form quickly.
        this.stiff = 0.0075;
        this.damp = 0.94;
        this.mixSpeed = 0.012;

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
        this.velocityVariable.material.uniforms.uRayO = { value: this.rayOrigin };
        this.velocityVariable.material.uniforms.uRayD = { value: this.rayDir };
        this.velocityVariable.material.uniforms.uPointerOn = { value: 0.0 };
        this.velocityVariable.material.uniforms.uMouseSpeed = { value: 0.0 };
        this.velocityVariable.material.uniforms.uStiff = { value: this.stiff };
        this.velocityVariable.material.uniforms.uDamp = { value: this.damp };
        this.gustNow = new THREE.Vector3();   // a shove given to every star, fading (see gust())
        this.offset = new THREE.Vector3();    // held stars sit this far from their places (see setOffset())
        this.level = 1;                       // how bright the stars are drawn, eased toward levelTo (see setLevel())
        this.levelTo = 1;
        this.velocityVariable.material.uniforms.uGust = { value: this.gustNow };
        this.velocityVariable.material.uniforms.uOffset = { value: this.offset };

        // Formations: each star has a target position in texture A and B; uMix blends them.
        // The alpha channel says how free the star is (1 = drifts as before, 0 = holds its place).
        this.formations = this.buildFormations();
        this.formA = 'cloud';
        this.formB = 'cloud';
        this.mix = 1;
        // Star colours per formation (white unless the formation is a picture).
        const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1, THREE.RGBAFormat);
        white.needsUpdate = true;
        this.white = white;
        this.colors = {};
        this.velocityVariable.material.uniforms.uTargetA = { value: this.formations.cloud };
        this.velocityVariable.material.uniforms.uTargetB = { value: this.formations.cloud };
        this.velocityVariable.material.uniforms.uMix = { value: 1.0 };

        // Initialize
        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error('GPUComputationRenderer error:', error);
        }

        // Create particles
        this.createParticles();

    }

    fillTextures(positionTexture, velocityTexture) {
        const posArray = positionTexture.image.data;
        const velArray = velocityTexture.image.data;
        this.homePositions = new Float32Array(posArray.length);

        for (let i = 0; i < posArray.length; i += 4) {
            // Initialize particles in condensed center volume
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 50 + Math.random() * 300; // Much more condensed: 50-350 instead of 200-1200

            posArray[i + 0] = radius * Math.sin(phi) * Math.cos(theta);
            posArray[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            posArray[i + 2] = radius * Math.cos(phi);
            posArray[i + 3] = radius; // Store original radius

            this.homePositions[i + 0] = posArray[i + 0];
            this.homePositions[i + 1] = posArray[i + 1];
            this.homePositions[i + 2] = posArray[i + 2];
            this.homePositions[i + 3] = 1.0; // free

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
            uniform vec3 uRayO;
            uniform vec3 uRayD;
            uniform float uPointerOn;
            uniform float uMouseSpeed;
            uniform float uStiff;
            uniform float uDamp;
            uniform vec3 uGust;
            uniform vec3 uOffset;
            uniform sampler2D uTargetA;
            uniform sampler2D uTargetB;
            uniform float uMix;

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

                // Where this star belongs in the current formation, and how free it is
                vec4 targetA = texture2D(uTargetA, uv);
                vec4 targetB = texture2D(uTargetB, uv);
                vec3 target = mix(targetA.xyz, targetB.xyz, uMix);
                float freeAmt = mix(targetA.w, targetB.w, uMix); // 1 = drifting cloud, 0 = held in a shape
                float held = 1.0 - freeAmt;

                // Medium damping for fluid motion (held stars use the formation's own damping)
                vel *= mix(0.94, uDamp, held);

                // Curl noise - increased for visible swirling (calmer while holding a shape)
                vec3 curl = computeCurl(pos, uTime);
                vel += curl * 0.05 * mix(0.22, 1.0, freeAmt);

                // Add rotational vortex force around center for cohesive swirling
                float distFromCenter = length(pos);
                vec3 toCenter = -normalize(pos);
                vec3 tangent = normalize(cross(pos, vec3(0.0, 1.0, 0.0))); // Perpendicular to radius

                // Stronger vortex near center, weaker at edges
                float vortexStrength = smoothstep(350.0, 50.0, distFromCenter) * 0.02;
                vel += tangent * vortexStrength * freeAmt;

                // Very weak attraction back to original position
                vec3 originalPos = normalize(pos) * originalRadius;
                vec3 toOrigin = originalPos - pos;
                vel += toOrigin * 0.0001 * freeAmt;

                // Gentle attraction toward center for cohesion
                vel += toCenter * 0.003 * smoothstep(350.0, 100.0, distFromCenter) * freeAmt;

                // Spring toward the formation target (moved aside while a picture is being dragged)
                vel += (target + uOffset - pos) * uStiff * held;

                // A gust: every star is shoved the same way, each by its own amount, so a
                // picture streaks sideways before the stars find their new places.
                float mine = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
                vel += uGust * (0.2 + 0.8 * mine * mine) * mix(0.3, 1.0, held);

                // Pointer: stars are pushed away from the line of sight through the cursor,
                // harder while the cursor is moving, so it leaves a wake in the field.
                vec3 rel = pos - uRayO;
                vec3 away = rel - uRayD * dot(rel, uRayD);
                float pd = length(away);
                const float REACH = 120.0;
                if (pd < REACH && pd > 0.01) {
                    float fall = 1.0 - pd / REACH;
                    float push = fall * fall * (0.07 + uMouseSpeed * 20.0) * uPointerOn;
                    vel += (away / pd) * push * mix(1.0, 2.4, held);
                    // a little swirl around the line, so the wake curls instead of just parting
                    vel += normalize(cross(uRayD, away)) * push * 0.55;
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


    // ---- Formations -------------------------------------------------------
    // Each builder fills a Float32Array of (x, y, z, free) per star.
    // About a third of the stars stay free in every shape so the field keeps its depth.
    buildFormations() {
        const size = this.textureSize;
        const count = size * size;
        const home = this.homePositions;
        const rand = (() => { let s = 1337; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
        const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rand(); return (u - 2) / 2; };

        const make = (fn, freeShare) => {
            const data = new Float32Array(count * 4);
            for (let i = 0; i < count; i++) {
                const o = i * 4;
                if (rand() < freeShare) {
                    data[o] = home[o]; data[o + 1] = home[o + 1]; data[o + 2] = home[o + 2]; data[o + 3] = 1;
                } else {
                    const p = fn();
                    data[o] = p[0]; data[o + 1] = p[1]; data[o + 2] = p[2]; data[o + 3] = 0;
                }
            }
            const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
            tex.needsUpdate = true;
            return tex;
        };

        const cloud = make(() => [0, 0, 0], 1);

        // Accretion ring: a thin bright band with a fainter outer disc.
        const ring = make(() => {
            const a = rand() * Math.PI * 2;
            const outer = rand() < 0.28;
            const r = outer ? 270 + rand() * 120 : 218 + gauss() * 16;
            const y = gauss() * (outer ? 5 : 9);
            return [Math.cos(a) * r, y, Math.sin(a) * r];
        }, 0.3);

        // Spiral galaxy: four arms and a core.
        const galaxy = make(() => {
            if (rand() < 0.16) {
                const r = Math.abs(gauss()) * 46;
                const a = rand() * Math.PI * 2;
                return [Math.cos(a) * r, gauss() * 14, Math.sin(a) * r];
            }
            const arm = Math.floor(rand() * 4);
            const t = Math.pow(rand(), 0.75);
            const r = 30 + t * 330;
            const a = arm * (Math.PI / 2) + t * 4.6 + gauss() * (0.42 - t * 0.2);
            return [Math.cos(a) * r, gauss() * (12 - t * 8), Math.sin(a) * r];
        }, 0.26);

        // LED stage: a curved wall of evenly spaced points with a floor grid running toward the viewer.
        const cols = 120, rows = 44, wallRadius = 420, wallZ = 130, floorY = -130;
        const wall = make(() => {
            if (rand() < 0.3) {
                for (let n = 0; n < 30; n++) {
                    const x = (Math.floor(rand() * 61) - 30) * 14;
                    const z = -290 + Math.floor(rand() * 44) * 14;
                    const dz = z - wallZ;
                    if (z > wallZ || x * x + dz * dz < wallRadius * wallRadius) return [x, floorY, z];
                }
                return [0, floorY, 0];
            }
            const c = Math.floor(rand() * cols), rw = Math.floor(rand() * rows);
            const arc = (c / (cols - 1) - 0.5) * 2.0; // about 115 degrees
            return [Math.sin(arc) * wallRadius, floorY + rw * (260 / (rows - 1)), -Math.cos(arc) * wallRadius + wallZ];
        }, 0.12);

        // Crescent: the moon from the Relic mark.
        const crescent = make(() => {
            for (let n = 0; n < 40; n++) {
                const a = rand() * Math.PI * 2;
                const r = Math.sqrt(rand()) * 210;
                const x = Math.cos(a) * r, y = Math.sin(a) * r;
                const dx = x - 78, dy = y - 34;
                if (dx * dx + dy * dy > 176 * 176) return [x, y, gauss() * (r > 198 ? 3 : 10)];
            }
            return [-200, 0, 0];
        }, 0.3);

        // Double helix column.
        const helix = make(() => {
            const t = rand();
            if (rand() < 0.22) {
                // rungs
                const k = Math.round(t * 34) / 34;
                const u = (rand() - 0.5) * 2;
                return [Math.cos(k * Math.PI * 7) * 92 * u, (k - 0.5) * 640, Math.sin(k * Math.PI * 7) * 92 * u];
            }
            const a = t * Math.PI * 7 + (rand() < 0.5 ? 0 : Math.PI);
            return [Math.cos(a) * 92 + gauss() * 5, (t - 0.5) * 640 + gauss() * 4, Math.sin(a) * 92 + gauss() * 5];
        }, 0.3);

        return { cloud, ring, galaxy, wall, crescent, helix };
    }

    // Move the stars toward a named formation. Unknown names fall back to the cloud.
    setFormation(name) {
        if (!this.formations) return;
        if (!this.formations[name]) name = 'cloud';
        if (name === this.formB) return;
        // Start from whichever shape the stars are closer to right now.
        this.formA = this.mix > 0.5 && this.formations[this.formB] ? this.formB : this.formA;
        this.formB = name;
        this.mix = 0;
        const u = this.velocityVariable.material.uniforms;
        u.uTargetA.value = this.formations[this.formA];
        u.uTargetB.value = this.formations[this.formB];
        u.uMix.value = 0;
        const art = name === 'art0' || name === 'art1';
        const pace = this.paces && this.paces[name]; // a formation added from outside may bring its own
        this.stiffTo = pace ? pace.stiff : art ? 0.03 : 0.0075;
        this.dampTo = pace ? pace.damp : art ? 0.885 : 0.94;
        this.mixSpeed = pace ? pace.mixSpeed : art ? 0.03 : 0.012;
        if (this.particles) {
            const pu = this.particles.material.uniforms;
            pu.uColorA.value = this.colors[this.formA] || this.white;
            pu.uColorB.value = this.colors[this.formB] || this.white;
            pu.uColorMix.value = 0;
        }
    }

    // Add a formation from outside. place(i) gives star i its spot as [x, y, z], or nothing to
    // leave that star drifting. pace (optional): { stiff, damp, mixSpeed }, how briskly the stars
    // take the shape (see setFormation for the usual values).
    addFormation(name, place, pace) {
        if (!this.formations) return;
        const size = this.textureSize, count = size * size, home = this.homePositions;
        const data = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
            const o = i * 4, p = place(i);
            if (p) { data[o] = p[0]; data[o + 1] = p[1]; data[o + 2] = p[2]; data[o + 3] = 0; }
            else { data[o] = home[o]; data[o + 1] = home[o + 1]; data[o + 2] = home[o + 2]; data[o + 3] = 1; }
        }
        const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.needsUpdate = true;
        this.formations[name] = tex;
        if (pace) { this.paces = this.paces || {}; this.paces[name] = pace; }
    }

    // Gather the stars into a picture.
    //   targets: Float32Array, 4 per star: x, y, z, free (1 = keeps drifting, 0 = takes its place)
    //   colors:  Uint8Array, 4 per star: r, g, b, 255 for a star that is part of the picture
    // Two slots alternate, so one picture can turn into the next.
    setArt(targets, colors) {
        if (!this.formations || !this.particles) return;
        const size = this.textureSize;
        const keep = this.mix > 0.5 ? this.formB : this.formA; // the shape the stars will start from
        const name = keep === 'art0' ? 'art1' : 'art0';
        if (!this.formations[name]) {
            const t = new THREE.DataTexture(new Float32Array(size * size * 4), size, size, THREE.RGBAFormat, THREE.FloatType);
            t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
            this.formations[name] = t;
            const c = new THREE.DataTexture(new Uint8Array(size * size * 4), size, size, THREE.RGBAFormat);
            c.minFilter = THREE.NearestFilter; c.magFilter = THREE.NearestFilter;
            this.colors[name] = c;
        }
        this.formations[name].image.data.set(targets);
        this.formations[name].needsUpdate = true;
        this.colors[name].image.data.set(colors);
        this.colors[name].needsUpdate = true;
        if (this.formB === name) this.formB = ''; // same slot, new picture: let setFormation run again
        this.setFormation(name);
    }

    // Number of stars (targets and colours passed to setArt hold 4 values for each).
    get starCount() { return this.textureSize * this.textureSize; }

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
                uCameraPosition: { value: this.camera.position },
                uColorA: { value: this.white },
                uColorB: { value: this.white },
                uColorMix: { value: 1 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
                uLevel: { value: 1 }
            },
            vertexShader: `
                uniform sampler2D uPositions;
                uniform sampler2D uVelocities;
                uniform float uTime;
                uniform vec3 uCameraPosition;
                uniform sampler2D uColorA;
                uniform sampler2D uColorB;
                uniform float uColorMix;
                uniform float uPixelRatio;

                attribute vec2 reference;

                varying float vSpeed;
                varying float vDepth;
                varying vec4 vTint; // rgb = picture colour, a = how much this star belongs to a picture

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

                    // Colour: white in the open field, the picture's colour when gathered into one
                    vec4 ca = texture2D(uColorA, reference);
                    vec4 cb = texture2D(uColorB, reference);
                    vTint = mix(ca, cb, uColorMix);

                    // Point size based on depth only (no speed boost for stability).
                    // Stars that make up a picture are a little larger so it reads as an image.
                    float baseSize = 1.5 + vDepth * 3.0;
                    gl_PointSize = baseSize + vTint.a * (1.1 + 0.7 * uPixelRatio);

                    // Very gentle twinkling effect
                    float twinkle = sin(uTime * 0.5 + pos.x * 0.05 + pos.y * 0.05) * 0.15 + 0.85;
                    gl_PointSize *= twinkle;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float uLevel;
                varying float vSpeed;
                varying float vDepth;
                varying vec4 vTint;

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

                    // White in the field; the picture's own colour when the star is part of one
                    vec3 color = mix(vec3(1.0), vTint.rgb * 1.5, vTint.a);
                    vec3 finalColor = color * (1.0 + bloom * 1.2 + speedGlow);
                    alpha *= mix(1.0, 1.35, vTint.a) * uLevel;

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

    // Called when the pointer moves: x and y run from -1 to 1 across the window.
    updateMouse(mouseX, mouseY) {
        const dx = mouseX - this.lastMousePos.x, dy = mouseY - this.lastMousePos.y;
        this.mouseSpeed = Math.min(0.12, this.mouseSpeed + Math.sqrt(dx * dx + dy * dy) * 0.5);
        this.lastMousePos.set(mouseX, mouseY);
        this.pointerOn = 1;
    }

    // The line of sight through the cursor, in world space (main.js works it out each frame).
    setPointerRay(origin, dir) {
        this.rayOrigin.copy(origin);
        this.rayDir.copy(dir);
    }

    pointerLeft() { this.pointerOn = 0; }

    // Shove every star sideways for a moment: x is -1 (to the left) to 1 (to the right).
    gust(x) { this.gustNow.set(x * 15, 0, 0); }

    // How bright the stars are drawn: 1 as usual, less when they are only dust in a 3D place.
    setLevel(v) { this.levelTo = v; }

    // Hold the stars of a picture this far to one side of their places (world units).
    setOffset(x) { this.offset.x = x; }

    update(time) {
        if (!this.gpuCompute || !this.particles) return;
        // Update GPGPU uniforms
        const vu = this.velocityVariable.material.uniforms;
        vu.uTime.value = time;
        vu.uMouseSpeed.value = this.mouseSpeed;
        vu.uPointerOn.value += (this.pointerOn - vu.uPointerOn.value) * 0.08;

        // Decay mouse speed
        this.mouseSpeed *= 0.9;
        if (this.gustNow.x) this.gustNow.x = Math.abs(this.gustNow.x) < 0.05 ? 0 : this.gustNow.x * 0.8;

        // Ease the pull strength toward what the current formation asks for
        if (this.stiffTo !== undefined) {
            this.stiff += (this.stiffTo - this.stiff) * 0.06;
            this.damp += (this.dampTo - this.damp) * 0.06;
            vu.uStiff.value = this.stiff;
            vu.uDamp.value = this.damp;
        }

        // Ease the blend between formations (positions and colours together)
        if (this.mix < 1) {
            this.mix = Math.min(1, this.mix + this.mixSpeed);
            const m = this.mix;
            const eased = m * m * (3 - 2 * m);
            vu.uMix.value = eased;
            this.particles.material.uniforms.uColorMix.value = eased;
        }

        // Compute GPGPU (this updates position and velocity textures)
        this.gpuCompute.compute();

        // Get computed textures and pass to particle material
        this.particles.material.uniforms.uPositions.value =
            this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
        this.particles.material.uniforms.uVelocities.value =
            this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture;
        this.particles.material.uniforms.uTime.value = time;
        this.level += (this.levelTo - this.level) * 0.05;
        this.particles.material.uniforms.uLevel.value = this.level;
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
