// Relic Studios — how each frame of the 3D background is put together.
//
//   1. the starfield is drawn and given its glow (bloom),
//   2. anything passed as `overlay` is drawn on top (the artwork sheet from js/artscene.js),
//   3. the finished picture goes to the screen through one last pass that reacts to the visitor:
//      it ripples where the pointer has just been, a click or tap sends a ring through it, and
//      it stretches and splits colour while the page is scrolling fast. The page text is ordinary
//      HTML above the canvas and is not touched.
class SimpleBloomComposer {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        const w = window.innerWidth, h = window.innerHeight;

        // Stars are drawn at CSS-pixel size (as before); the final picture uses every device pixel.
        this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            encoding: THREE.sRGBEncoding,
            stencilBuffer: true // gives the deeper kind of depth store: a star just behind a far truss of the 3D place (js/venue.js) is then hidden, not shown through it
        });
        this.bloomTarget = new THREE.WebGLRenderTarget(Math.floor(w / 2), Math.floor(h / 2));
        this.blurTarget = new THREE.WebGLRenderTarget(Math.floor(w / 2), Math.floor(h / 2));

        const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
        this.finalTarget = new THREE.WebGLRenderTarget(buf.x, buf.y, {
            minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false
        });

        // Pointer wake: a small picture of where the pointer has pushed, which fades and spreads.
        const trail = this.trailSize(w, h);
        const trailOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false };
        this.trailA = new THREE.WebGLRenderTarget(trail.x, trail.y, trailOpts);
        this.trailB = new THREE.WebGLRenderTarget(trail.x, trail.y, trailOpts);
        this.trailFresh = true;

        this.point = new THREE.Vector2(0.5, 0.5);
        this.from = new THREE.Vector2(0.5, 0.5); // where the pointer was at the last frame
        this.lastPoint = null;
        this.delta = new THREE.Vector2(0, 0);
        this.press = 0;       // 0 to 1: a press at `point`, used up by the next frame
        this.glitch = 0;      // 0 to 1: a burst of signal tearing, fades by itself (set it to start one)
        this.swoosh = 0;      // -1 to 1: the whole image streaks sideways (negative = to the left), fades by itself
        this.scrollVel = 0;   // -1 to 1, set from main.js
        this.amount = 1;      // 0 switches the reactive pass off (reduced motion)

        this.createShaders();
    }

    trailSize(w, h) {
        const x = 192;
        return new THREE.Vector2(x, Math.max(48, Math.round(x * h / Math.max(1, w))));
    }

    createShaders() {
        const quadVertex = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        // Optimized brightness extraction
        this.brightnessShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                threshold: { value: 0.25 }
            },
            vertexShader: quadVertex,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float threshold;
                varying vec2 vUv;

                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

                    if (brightness > threshold) {
                        gl_FragColor = color;
                    } else {
                        gl_FragColor = vec4(0.0);
                    }
                }
            `
        });

        // Soft round blur, run twice (across, then down). The glow is drawn at half size, so a
        // square blur shows as blocks around each star on sharp screens; this one stays round.
        this.blurShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                resolution: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
                direction: { value: new THREE.Vector2(1, 0) }
            },
            vertexShader: quadVertex,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec2 resolution;
                uniform vec2 direction;
                varying vec2 vUv;

                void main() {
                    vec2 stepUv = direction / resolution;
                    vec4 result = texture2D(tDiffuse, vUv) * 0.2941;
                    result += (texture2D(tDiffuse, vUv + stepUv * 1.3333) + texture2D(tDiffuse, vUv - stepUv * 1.3333)) * 0.3529;
                    gl_FragColor = result;
                }
            `
        });

        // Optimized composite with better color preservation
        this.compositeShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tBloom: { value: null },
                bloomStrength: { value: 1.8 }
            },
            vertexShader: quadVertex,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform sampler2D tBloom;
                uniform float bloomStrength;
                varying vec2 vUv;

                void main() {
                    vec4 original = texture2D(tDiffuse, vUv);
                    vec4 bloom = texture2D(tBloom, vUv);

                    // Optimized additive blend with color preservation
                    vec3 bloomColor = bloom.rgb * bloomStrength;
                    vec3 result = original.rgb + bloomColor;

                    // Subtle tone mapping to preserve color depth
                    result = result / (result + vec3(1.0));
                    result = pow(result, vec3(0.9)); // Slight gamma adjustment for richness

                    gl_FragColor = vec4(result, 1.0);
                }
            `
        });

        // Pointer wake. Each pixel holds a small push (x, y) stored around the middle grey value.
        this.trailShader = new THREE.ShaderMaterial({
            uniforms: {
                tPrev: { value: null },
                uTexel: { value: new THREE.Vector2(1 / 192, 1 / 108) },
                uPoint: { value: this.point },
                uFrom: { value: this.from },
                uDelta: { value: this.delta },
                uAspect: { value: 1 },
                uPress: { value: 0 },
                uReset: { value: 1 }
            },
            vertexShader: quadVertex,
            fragmentShader: `
                uniform sampler2D tPrev;
                uniform vec2 uTexel;
                uniform vec2 uPoint;
                uniform vec2 uFrom;
                uniform vec2 uDelta;
                uniform float uAspect;
                uniform float uPress;
                uniform float uReset;
                varying vec2 vUv;
                const float MID = 128.0 / 255.0;

                void main() {
                    vec2 here = texture2D(tPrev, vUv).rg;
                    vec2 around = (texture2D(tPrev, vUv + vec2(uTexel.x, 0.0)).rg + texture2D(tPrev, vUv - vec2(uTexel.x, 0.0)).rg
                                 + texture2D(tPrev, vUv + vec2(0.0, uTexel.y)).rg + texture2D(tPrev, vUv - vec2(0.0, uTexel.y)).rg) * 0.25;
                    vec2 f = (mix(here, around, 0.4) - MID) * 0.955;      // spread out and fade
                    f = sign(f) * max(abs(f) - 0.7 / 255.0, 0.0);         // and reach exactly zero
                    // The push is laid along the whole stroke since the last frame, so a fast move
                    // (or a phone that reports a finger only a few times a second) leaves no gaps.
                    vec2 pa = vUv - uFrom, ba = uPoint - uFrom;
                    pa.x *= uAspect; ba.x *= uAspect;
                    vec2 along = pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
                    f += uDelta * exp(-dot(along, along) / 0.0052);       // the pointer's push
                    vec2 d = vUv - uPoint;
                    d.x *= uAspect;
                    f += d * 11.0 * exp(-dot(d, d) / 0.008) * uPress;      // a press: a ring pushing outward
                    f = mix(clamp(f, -0.49, 0.49), vec2(0.0), uReset);
                    gl_FragColor = vec4(f + MID, 0.0, 1.0);
                }
            `
        });

        // Last pass: the reactive lens.
        this.finalShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tTrail: { value: null },
                uVel: { value: 0 },
                uGlitch: { value: 0 },
                uSwoosh: { value: 0 },
                uTime: { value: 0 },
                uAmount: { value: 1 }
            },
            vertexShader: quadVertex,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform sampler2D tTrail;
                uniform float uVel;
                uniform float uGlitch;
                uniform float uSwoosh;
                uniform float uTime;
                uniform float uAmount;
                varying vec2 vUv;
                const float MID = 128.0 / 255.0;

                void main() {
                    vec2 uv = vUv;
                    vec2 c = uv - 0.5;
                    float v = uVel * uAmount;

                    // A burst of signal tearing when the picture changes: some rows jump sideways
                    // for a few frames, like a monitor losing sync.
                    float g = uGlitch * uAmount;
                    if (g > 0.01) {
                        float row = floor(vUv.y * 38.0);
                        float h = fract(sin(row * 91.7 + floor(uTime * 24.0) * 37.3) * 43758.5453);
                        uv.x += (fract(h * 17.3) - 0.5) * 0.085 * g * step(1.0 - g * 0.5, h);
                    }

                    // A picture changed by hand: everything is swept sideways for a moment, the
                    // middle rows leading and the top and bottom trailing.
                    float sw = uSwoosh * uAmount;
                    uv.x -= sw * 0.03 * (1.0 - c.y * c.y * 3.2);

                    // Scrolling: the picture bows like a sheet being pulled, edges trailing the middle.
                    uv.y += v * 0.05 * (c.x * c.x * 2.4 - 0.1);
                    uv.x += c.x * abs(v) * 0.035 * (c.y * c.y * 4.0);

                    // Pointer: the picture is dragged along where the pointer has just passed.
                    vec2 flow = (texture2D(tTrail, vUv).rg - MID) * 2.0 * uAmount;
                    uv -= flow * 0.045;

                    // Colours separate along the motion, plus a trace of lens fringing at the corners.
                    // Where the pointer has pushed hard the picture is a lattice of small points
                    // (js/artscene.js); splitting those turns them into coloured static, so the
                    // split fades out there and only fringes the edge of the wake.
                    float hard = smoothstep(0.18, 0.5, length(flow));
                    vec2 split = flow * 0.0045 * (1.0 - hard) + vec2(g * 0.006 + sw * 0.009, v * 0.007) + c * dot(c, c) * 0.004;
                    vec3 col = vec3(
                        texture2D(tDiffuse, uv + split).r,
                        texture2D(tDiffuse, uv).g,
                        texture2D(tDiffuse, uv - split).b
                    );

                    // Fast scrolling smears the picture along the scroll.
                    float smear = min(1.0, abs(v) * 1.6);
                    if (smear > 0.03) {
                        vec3 s = col;
                        for (float i = -2.0; i <= 2.0; i += 1.0) {
                            if (i != 0.0) s += texture2D(tDiffuse, uv + vec2(0.0, i * v * 0.011)).rgb;
                        }
                        col = mix(col, s / 5.0, smear);
                    }
                    // ...and the sweep leaves streaks behind whatever is moving.
                    float streak = min(1.0, abs(sw) * 1.5);
                    if (streak > 0.03) {
                        vec3 s = col;
                        float total = 1.0;
                        for (float i = 1.0; i <= 6.0; i += 1.0) {
                            float wt = 1.0 - i / 7.0;
                            s += texture2D(tDiffuse, uv + vec2(sw * i * 0.017, 0.0)).rgb * wt;
                            total += wt;
                        }
                        col = mix(col, s / total, streak);
                    }
                    gl_FragColor = vec4(col, 1.0);
                }
            `
        });

        // Create quad
        this.quad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            this.brightnessShader
        );

        this.quadScene = new THREE.Scene();
        this.quadScene.add(this.quad);
        this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }

    // A press or tap at the pointer (0..1 across and up the window): strength 0 to 1.
    pressAt(x, y, strength) {
        this.pointer(x, y, true);
        this.from.set(x, y);
        this.press = Math.max(this.press, strength === undefined ? 1 : strength);
    }

    // Where the pointer is, as 0..1 across and up the window. Call on every pointer move.
    // `jump` = the pointer arrived here without travelling (a new touch): no push for this step.
    pointer(x, y, jump) {
        if (this.lastPoint && !jump) {
            this.delta.x += (x - this.lastPoint.x) * 9;
            this.delta.y += (y - this.lastPoint.y) * 9;
            this.delta.clampScalar(-0.45, 0.45);
        } else if (!this.lastPoint) {
            this.lastPoint = new THREE.Vector2();
        }
        this.lastPoint.set(x, y);
        this.point.set(x, y);
    }

    pass(material, target) {
        this.quad.material = material;
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.quadScene, this.quadCamera);
    }

    // overlay(target): optional, draws on top of the finished starfield before the last pass.
    render(overlay) {
        const r = this.renderer;

        // Render scene to texture
        r.setRenderTarget(this.renderTarget);
        r.render(this.scene, this.camera);

        // Extract bright areas
        this.brightnessShader.uniforms.tDiffuse.value = this.renderTarget.texture;
        this.pass(this.brightnessShader, this.bloomTarget);

        // Blur: across into blurTarget, then down back into bloomTarget, then once more a little wider
        const bu = this.blurShader.uniforms;
        bu.tDiffuse.value = this.bloomTarget.texture;
        bu.direction.value.set(1, 0);
        this.pass(this.blurShader, this.blurTarget);
        bu.tDiffuse.value = this.blurTarget.texture;
        bu.direction.value.set(0, 1);
        this.pass(this.blurShader, this.bloomTarget);
        bu.tDiffuse.value = this.bloomTarget.texture;
        bu.direction.value.set(0.7071, 0.7071);
        this.pass(this.blurShader, this.blurTarget);

        // Starfield and its glow
        this.compositeShader.uniforms.tDiffuse.value = this.renderTarget.texture;
        this.compositeShader.uniforms.tBloom.value = this.blurTarget.texture;
        this.pass(this.compositeShader, this.finalTarget);

        if (typeof overlay === 'function') overlay(this.finalTarget);

        // Pointer wake
        const tu = this.trailShader.uniforms;
        tu.tPrev.value = this.trailA.texture;
        tu.uReset.value = this.trailFresh ? 1 : 0;
        tu.uPress.value = this.press * this.amount;
        this.press = 0;
        this.pass(this.trailShader, this.trailB);
        this.trailFresh = false;
        const swap = this.trailA; this.trailA = this.trailB; this.trailB = swap;
        this.delta.set(0, 0);
        this.from.copy(this.point);

        // To the screen
        const fu = this.finalShader.uniforms;
        fu.tDiffuse.value = this.finalTarget.texture;
        fu.tTrail.value = this.trailA.texture;
        fu.uVel.value = this.scrollVel;
        fu.uGlitch.value = this.glitch;
        fu.uTime.value = (performance.now() / 1000) % 600;
        this.glitch = this.glitch < 0.02 ? 0 : this.glitch * 0.87;
        fu.uSwoosh.value = this.swoosh;
        this.swoosh = Math.abs(this.swoosh) < 0.02 ? 0 : this.swoosh * 0.9;
        fu.uAmount.value = this.amount;
        this.pass(this.finalShader, null);
    }

    resize(width, height) {
        this.renderTarget.setSize(width, height);
        this.bloomTarget.setSize(Math.floor(width / 2), Math.floor(height / 2));
        this.blurTarget.setSize(Math.floor(width / 2), Math.floor(height / 2));
        this.blurShader.uniforms.resolution.value.set(Math.floor(width / 2), Math.floor(height / 2));
        const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
        this.finalTarget.setSize(buf.x, buf.y);
        const trail = this.trailSize(width, height);
        this.trailA.setSize(trail.x, trail.y);
        this.trailB.setSize(trail.x, trail.y);
        this.trailShader.uniforms.uTexel.value.set(1 / trail.x, 1 / trail.y);
        this.trailShader.uniforms.uAspect.value = width / Math.max(1, height);
        this.trailFresh = true;
    }

    dispose() {
        this.renderTarget.dispose();
        this.bloomTarget.dispose();
        this.blurTarget.dispose();
        this.finalTarget.dispose();
        this.trailA.dispose();
        this.trailB.dispose();
        this.brightnessShader.dispose();
        this.blurShader.dispose();
        this.compositeShader.dispose();
        this.trailShader.dispose();
        this.finalShader.dispose();
        this.quad.geometry.dispose();
    }
}

window.SimpleBloomComposer = SimpleBloomComposer;
