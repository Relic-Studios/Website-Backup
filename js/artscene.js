/* Relic Studios — artwork as 3D scenes.

   A section of a page can name a picture (data-art). While that section is on screen:
     1. the stars gather into the picture as a cloud of coloured points,
     2. the picture itself burns in over them, highlights first, as a sheet with real relief
        (a depth map pushes near parts toward the viewer), so it shifts like a scene when the
        pointer moves or the page scrolls,
     3. where the pointer has just passed, the sheet breaks into a lattice of light points,
     4. when the section leaves, the picture burns away while the next one arrives (there are
        two sheets, so one can leave as the other comes in) and the stars move on.

   Two ways to show a picture (data-art-mode):
     frame     the picture stands beside the text, whole (default)
     backdrop  the picture fills the window behind the text

   This file owns the picture sheet and works out where each star goes. js/main.js decides when
   to show what, and js/gpgpu-starfield.js moves the stars.

   Depth maps are made by tools/make-depth.py. A picture without one still works: brightness is
   used as a rough stand-in. */
(function () {
    'use strict';
    if (!window.THREE) return;
    const THREE = window.THREE;

    const DIST = 520;        // camera distance the layout is designed for (see POSES.art in main.js)
    const DOTS_FIRST = 0.5;  // seconds after the stars set off before the picture starts to burn in
    const BURN_IN = 0.9;     // seconds for the picture to burn in
    const BURN_OUT = 0.4;    // seconds for it to burn away
    const PUSH_AFTER = 0.2;  // while the page is scrolling through a picture's section it burns in
    const BURN_PUSHED = 0.4; // sooner and faster than that, so a steady scroll still shows every picture

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('could not load ' + src));
            img.src = src;
        });
    }

    function canvasOf(img, w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        return c;
    }
    const pixelsOf = (canvas) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;

    // Stand-in depth for a picture that has no depth map: soft brightness, nearer in the middle.
    function roughDepth(img, w, h) {
        const small = canvasOf(img, Math.max(4, w >> 3), Math.max(4, h >> 3));
        const c = canvasOf(small, w, h);
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const lum = (d.data[i] * 0.2126 + d.data[i + 1] * 0.7152 + d.data[i + 2] * 0.0722) / 255;
                const dx = x / w - 0.5, dy = y / h - 0.5;
                const v = Math.max(0, Math.min(1, lum * 0.75 + (0.5 - Math.sqrt(dx * dx + dy * dy)) * 0.5));
                d.data[i] = d.data[i + 1] = d.data[i + 2] = v * 255;
            }
        }
        ctx.putImageData(d, 0, 0);
        return c;
    }

    // Where each star sits in the picture (u, v, depth), its colour, and whether it stays free.
    // Stars go where the picture is bright, so a dark picture with a lit subject reads clearly.
    function scatterStars(color, depth, w, h, count) {
        let seed = 20261117;
        const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        const cells = w * h;
        const cdf = new Float32Array(cells);
        let total = 0;
        for (let i = 0; i < cells; i++) {
            const o = i * 4;
            const lum = (color[o] * 0.2126 + color[o + 1] * 0.7152 + color[o + 2] * 0.0722) / 255;
            total += Math.pow(lum, 1.15) + 0.012;
            cdf[i] = total;
        }
        const uvd = new Float32Array(count * 3);
        const free = new Uint8Array(count);
        const colors = new Uint8Array(count * 4);
        for (let k = 0; k < count; k++) {
            if (rand() < 0.2) { // a fifth of the stars keep drifting, so the field around the picture stays alive
                free[k] = 1;
                colors[k * 4] = colors[k * 4 + 1] = colors[k * 4 + 2] = 255;
                continue;
            }
            const r = rand() * total;
            let lo = 0, hi = cells - 1;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
            const cx = lo % w, cy = (lo / w) | 0, o = lo * 4;
            uvd[k * 3] = (cx + rand()) / w;
            uvd[k * 3 + 1] = (cy + rand()) / h;
            uvd[k * 3 + 2] = depth[o] / 255;
            // Keep the hue, lift the brightness: these are points of light, not pixels.
            const R = color[o], G = color[o + 1], B = color[o + 2];
            const max = Math.max(R, G, B, 40);
            const lum = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 255;
            const lift = (130 + 125 * Math.pow(lum, 0.6)) / max;
            // ...and push the colour away from grey, because the glow around each point washes it out.
            const grey = (R + G + B) / 3;
            const rich = (v) => Math.max(0, Math.min(255, (grey + (v - grey) * 1.9) * lift));
            colors[k * 4] = rich(R);
            colors[k * 4 + 1] = rich(G);
            colors[k * 4 + 2] = rich(B);
            colors[k * 4 + 3] = 255;
        }
        return { uvd, free, colors };
    }

    const SHEET_VERTEX = `
        uniform sampler2D uDepth;
        uniform vec2 uSize;
        uniform float uOffsetY;
        uniform float uDepthScale;
        uniform float uDist;
        uniform float uRelief;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            float z = (texture2D(uDepth, uv).r - 0.5) * uDepthScale * uRelief;
            vec2 xy = vec2((uv.x - 0.5) * uSize.x, (uv.y - 0.5) * uSize.y + uOffsetY);
            // Near parts are drawn a little smaller and far parts a little larger, by exactly
            // what perspective will add back. Seen head-on the picture is unchanged; the
            // relief only shows when the camera moves.
            xy *= (uDist - z) / uDist;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(xy, z, 1.0);
        }
    `;

    const SHEET_FRAGMENT = `
        uniform sampler2D uMap;
        uniform sampler2D uTrail;
        uniform vec2 uRes;
        uniform float uReveal;
        uniform float uSeed;
        uniform float uAspect;
        uniform float uDots;
        varying vec2 vUv;

        const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
        const vec3 GLOW = vec3(0.55, 0.95, 0.92);

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) { return noise(p) * 0.55 + noise(p * 2.1 + 7.3) * 0.3 + noise(p * 4.3 + 1.7) * 0.15; }

        void main() {
            vec4 c = texture2D(uMap, vUv);
            float lum = dot(c.rgb, LUMA);

            // Burn in: the lit parts arrive first, the shadows last, broken up by noise.
            vec2 np = vec2(vUv.x * uAspect, vUv.y) * 5.0 + uSeed;
            float order = clamp((1.0 - lum) * 0.5 + fbm(np) * 0.5, 0.0, 1.0);
            float edge = uReveal * 1.3 - order;
            float alpha = smoothstep(0.0, 0.14, edge);
            // a thin hot line where the picture is arriving or leaving
            float burn = smoothstep(0.0, 0.012, edge) * (1.0 - smoothstep(0.012, 0.07, edge));
            vec3 col = c.rgb + GLOW * burn * 0.7;

            // Where the pointer has just passed, the sheet comes apart into a lattice of light
            // points, each one the colour of the picture under it and larger where it is bright.
            vec2 g = vec2(vUv.x * uAspect, vUv.y) * uDots;
            vec2 cell = floor(g) + 0.5;
            vec3 point = texture2D(uMap, vec2(cell.x / uAspect, cell.y) / uDots).rgb;
            float pl = dot(point, LUMA);
            float rad = 0.19 + 0.24 * sqrt(pl);
            float inPoint = 1.0 - smoothstep(rad - 0.1, rad + 0.06, length(g - cell));

            vec2 flow = (texture2D(uTrail, gl_FragCoord.xy / uRes).rg - 128.0 / 255.0) * 2.0;
            float torn = smoothstep(0.1, 0.5, length(flow) + (fbm(np * 3.0) - 0.5) * 0.14);
            col = mix(col, point * (1.25 + 0.7 * pl) + GLOW * 0.06, torn);
            alpha *= mix(1.0, inPoint, torn);
            col += GLOW * torn * (1.0 - torn) * 0.8; // a lit rim where it comes apart

            // The sheet has no hard border: it thins out into the field.
            vec2 m = min(vUv, 1.0 - vUv);
            float feather = smoothstep(0.0, 0.045, m.x * uAspect) * smoothstep(0.0, 0.045, m.y);
            gl_FragColor = vec4(col, alpha * feather);
        }
    `;

    // One picture sheet. The stage has two, so a picture can burn away while the next burns in.
    function makeSheet(geometry, still) {
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthTest: false,
            depthWrite: false,
            uniforms: {
                uMap: { value: null },
                uDepth: { value: null },
                uTrail: { value: still },
                uRes: { value: new THREE.Vector2(1, 1) },
                uSize: { value: new THREE.Vector2(1, 1) },
                uOffsetY: { value: 0 },
                uDepthScale: { value: 1 },
                uDist: { value: DIST },
                uRelief: { value: 0 },
                uReveal: { value: 0 },
                uSeed: { value: 0 },
                uAspect: { value: 1 },
                uDots: { value: 100 }
            },
            vertexShader: SHEET_VERTEX,
            fragmentShader: SHEET_FRAGMENT
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.visible = false;
        return { material, mesh, asset: null, mode: 'frame', id: null, reveal: 0 };
    }

    class ArtStage {
        constructor(renderer, camera, starfield) {
            this.renderer = renderer;
            this.camera = camera;
            this.starfield = starfield;
            this.scene = new THREE.Scene();
            this.cache = new Map();
            this.wanted = null;    // id (src + mode) the page is asking for, or null
            this.front = null;     // the sheet that holds, or last held, the wanted picture
            this.t = 0;            // seconds since the stars were sent to the wanted picture
            this.shift = 0;        // how far main.js should slide the view sideways for this picture
            this.view = { w: window.innerWidth, h: window.innerHeight };
            this.webgl2 = !!renderer.capabilities.isWebGL2;
            this.onError = null;   // called if a picture cannot be loaded

            // "No pointer movement" for when the caller gives no pointer trail.
            this.still = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1, THREE.RGBAFormat);
            this.still.needsUpdate = true;

            const geometry = new THREE.PlaneGeometry(1, 1, 112, 144);
            this.sheets = [makeSheet(geometry, this.still), makeSheet(geometry, this.still)];
            this.sheets.forEach((s) => this.scene.add(s.mesh));
        }

        // piece: { src, full, depth, mode } (URLs; `full`, `depth` and `mode` are optional)
        load(piece) {
            const key = piece.src;
            if (this.cache.has(key)) return this.cache.get(key);
            const big = Math.max(this.view.w, this.view.h) * Math.min(window.devicePixelRatio || 1, 2) > 1300;
            const url = big && piece.full ? piece.full : piece.src;
            const promise = Promise.all([
                loadImage(url).catch(() => loadImage(piece.src)),
                piece.depth ? loadImage(piece.depth).catch(() => null) : Promise.resolve(null)
            ]).then(([img, depthImg]) => {
                const aspect = img.naturalWidth / img.naturalHeight;
                const w = aspect >= 1 ? 200 : Math.max(8, Math.round(200 * aspect));
                const h = aspect >= 1 ? Math.max(8, Math.round(200 / aspect)) : 200;
                const depthCanvas = depthImg ? canvasOf(depthImg, w, h) : roughDepth(img, w, h);

                const map = new THREE.Texture(img);
                map.generateMipmaps = this.webgl2;
                map.minFilter = this.webgl2 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
                map.magFilter = THREE.LinearFilter;
                map.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
                map.needsUpdate = true;

                const depth = new THREE.Texture(depthImg || depthCanvas);
                depth.generateMipmaps = false;
                depth.minFilter = THREE.LinearFilter;
                depth.magFilter = THREE.LinearFilter;
                depth.needsUpdate = true;

                const stars = scatterStars(pixelsOf(canvasOf(img, w, h)), pixelsOf(depthCanvas), w, h, this.starfield.starCount);
                return { key, map, depth, aspect, stars };
            });
            this.cache.set(key, promise);
            promise.catch(() => this.cache.delete(key));
            return promise;
        }

        // Size and place of a picture in the view, in world units at the layout distance.
        // `px` is its height on screen in CSS pixels.
        boxFor(asset, mode) {
            const va = this.view.w / this.view.h;
            const visH = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
            const visW = visH * va;
            const px = (h) => (h / visH) * this.view.h;
            if (mode === 'backdrop') { // fills the window, with a margin so camera moves never show its edge
                const h = Math.max(visH, visW / asset.aspect) * 1.2, w = h * asset.aspect;
                return { w, h, y: 0, shift: 0, depth: Math.min(visW, visH) * 0.5, px: px(h) };
            }
            let maxW, maxH, shift = 0, y = 0;
            if (va >= 1.3 && asset.aspect < 1) { maxH = visH * 0.8; maxW = visW * 0.44; shift = 0.17; }       // tall picture, wide screen: on the right
            else if (va >= 1.3) { maxH = visH * 0.7; maxW = visW * 0.6; shift = 0.13; y = visH * 0.015; }     // wide picture, wide screen
            else { maxH = visH * 0.58; maxW = visW * 0.9; y = visH * 0.08; }                                  // phone: above the caption
            const h = Math.min(maxH, maxW / asset.aspect), w = h * asset.aspect;
            return { w, h, y, shift, depth: Math.min(w, h) * 0.3, px: px(h) };
        }

        // Tell the starfield where every star belongs for this picture.
        sendStars(asset, mode) {
            const box = this.boxFor(asset, mode);
            const { uvd, free, colors } = asset.stars;
            const count = this.starfield.starCount;
            const home = this.starfield.homePositions;
            const out = new Float32Array(count * 4);
            for (let k = 0; k < count; k++) {
                const o = k * 4;
                if (free[k]) { out[o] = home[o]; out[o + 1] = home[o + 1]; out[o + 2] = home[o + 2]; out[o + 3] = 1; continue; }
                const z = (uvd[k * 3 + 2] - 0.5) * box.depth;
                const s = (DIST - z) / DIST; // same perspective correction as the sheet
                out[o] = (uvd[k * 3] - 0.5) * box.w * s;
                out[o + 1] = ((0.5 - uvd[k * 3 + 1]) * box.h + box.y) * s;
                out[o + 2] = z + 1.5;
                out[o + 3] = 0;
            }
            this.shift = box.shift;
            this.starfield.setArt(out, colors);
        }

        // Size a sheet for the picture it holds.
        place(sheet) {
            const box = this.boxFor(sheet.asset, sheet.mode);
            const u = sheet.material.uniforms;
            u.uSize.value.set(box.w, box.h);
            u.uOffsetY.value = box.y;
            u.uDepthScale.value = box.depth;
            u.uDots.value = Math.max(36, Math.round(box.px / 7)); // lattice points about 7 px apart
            return box;
        }

        // Put a loaded picture on a sheet, unseen until it burns in.
        put(sheet, asset, mode, id) {
            sheet.asset = asset;
            sheet.mode = mode;
            sheet.id = id;
            sheet.reveal = 0;
            const u = sheet.material.uniforms;
            u.uMap.value = asset.map;
            u.uDepth.value = asset.depth;
            u.uAspect.value = asset.aspect;
            u.uSeed.value = Math.random() * 40;
            this.place(sheet);
        }

        // Make a sheet the one the page is asking for: it is drawn over the one that is leaving.
        bring(sheet) {
            this.front = sheet;
            this.sheets.forEach((s) => { s.mesh.renderOrder = s === sheet ? 2 : 1; });
        }

        show(piece) {
            const mode = piece.mode === 'backdrop' ? 'backdrop' : 'frame';
            const id = piece.src + '|' + mode;
            if (this.wanted === id) return;
            this.wanted = id; // from now on any other picture burns away
            const held = this.sheets.find((s) => s.asset && s.id === id);
            if (held) {
                // Coming back to a picture that has not finished burning away.
                this.bring(held);
                this.t = DOTS_FIRST * 0.6;
                this.sendStars(held.asset, mode);
                return;
            }
            this.load(piece).then((asset) => {
                if (this.wanted !== id) return;
                // Use the emptier sheet; the other one carries on burning away underneath.
                const sheet = this.sheets[0].reveal <= this.sheets[1].reveal ? this.sheets[0] : this.sheets[1];
                this.put(sheet, asset, mode, id);
                this.bring(sheet);
                this.t = 0;
                this.sendStars(asset, mode); // the stars set off at once
            }).catch(() => { if (this.onError) this.onError(piece); });
        }

        hide() { this.wanted = null; }

        // Fetch a picture ahead of time so the next section does not wait for it.
        preload(piece) { this.load(piece).catch(() => {}); }

        get active() { return !!this.wanted; }
        get reveal() { return this.front ? this.front.reveal : 0; }

        // dt: seconds since the last frame. push: 0 to 1, how far the page has scrolled into the
        // picture's section (see main.js); the picture is never less burned in than that.
        update(dt, push) {
            this.t += dt;
            for (const s of this.sheets) {
                if (!s.asset) continue;
                if (s === this.front && this.wanted === s.id) {
                    let r = s.reveal;
                    if (this.t > DOTS_FIRST) r = Math.min(1, r + dt / BURN_IN);
                    if (push > r && this.t > PUSH_AFTER) r = Math.max(r, Math.min(push, s.reveal + dt / BURN_PUSHED));
                    s.reveal = r;
                } else {
                    s.reveal = Math.max(0, s.reveal - dt / BURN_OUT);
                    if (s.reveal === 0) { s.asset = null; s.id = null; }
                }
                const r = s.reveal;
                s.material.uniforms.uReveal.value = r;
                s.material.uniforms.uRelief.value = r * r * (3 - 2 * r);
                s.mesh.visible = !!s.asset && r > 0.001;
            }
        }

        // Draw the sheets over whatever is already in `target`. `trail` is the pointer-trail texture
        // from js/simple-bloom.js (optional).
        render(target, trail) {
            if (!this.sheets[0].mesh.visible && !this.sheets[1].mesh.visible) return;
            const r = this.renderer;
            for (const s of this.sheets) {
                const u = s.material.uniforms;
                u.uTrail.value = trail || this.still;
                if (target) u.uRes.value.set(target.width, target.height); else r.getDrawingBufferSize(u.uRes.value);
            }
            const auto = r.autoClear;
            r.autoClear = false;
            r.setRenderTarget(target);
            r.render(this.scene, this.camera);
            r.autoClear = auto;
        }

        resize(w, h) {
            this.view.w = w; this.view.h = h;
            this.sheets.forEach((s) => { if (s.asset) this.place(s); });
            const f = this.front;
            if (f && f.asset && this.wanted === f.id) this.sendStars(f.asset, f.mode);
        }
    }

    ArtStage.DIST = DIST;
    window.ArtStage = ArtStage;
})();
