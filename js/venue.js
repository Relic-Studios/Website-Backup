/* Relic Studios — the truss cathedral: a real 3D place the camera travels through.

   A nave of pointed arches built from stage truss, with a tall LED wall where the altar window
   would be. The model is made in Blender (tools/venue/, see PROJECT_NOTES.md) and stored as
   assets/3d/venue.json + venue.bin. Its lighting is baked into every vertex twice: once lit only
   by the LED wall (white), once by everything else.

   It is drawn in the page's own terms, light on black:
   - the truss is dark metal, shown by the light of the wall (the first bake times the colour of
     the picture that is on it), a cool trace of the second bake, and a cyan glint on its edges;
   - the floor is a black mirror: it shows the wall and little else, so the place has no edge;
   - it is not switched on, it assembles: every piece of truss and every panel of the wall
     starts far out to the side it belongs on and flies in to lock into place, the wall end
     first. The stars gather along the structure at the same time (js/main.js gives them the
     places from starPlaces()).

   How it gets into the frame (js/main.js drives all of this):
   - render() draws the place into a picture of its own, with smoothed edges (thin truss needs it);
   - draw() adds that picture to the finished starfield;
   - `mask` is the same model drawn invisibly among the stars, so a star behind a truss or the
     wall is hidden by it. The floor hides nothing: stars under it read as their reflections.

   Needs three.js r128. window.RelicVenue is the class; js/main.js owns the one instance. */
(function () {
    'use strict';
    const THREE = window.THREE;
    if (!THREE) return;

    const PANEL = 27.5;   // an LED panel is about this wide and high, model units (20 to the metre)

    // Where a point of a piece is while the place assembles. A piece comes from the side it
    // stands on (pieces on the centre line drop in from above, or rise through the floor),
    // turning as it comes; long pieces turn less. Pieces near the wall and near the floor go first.
    const FLY = `
        uniform float uShow;      // 0 to 1: how far the place has assembled
        uniform float uLength;    // length of the nave, model units
        attribute vec4 aPiece;    // xyz: the middle of the piece this point belongs to. w: below 0 for a piece
                                  // that stays put; else whole part = how long it is (0 to 2), fraction = its own random number
        varying float vIn;        // 0 to 1: how far this piece has come in

        vec3 fly(vec3 p) {
            if (aPiece.w < 0.0) { vIn = clamp(uShow * 1.4, 0.0, 1.0); return p; }
            float seed = fract(aPiece.w), big = floor(aPiece.w);
            float r1 = fract(seed * 3.17), r2 = fract(seed * 5.31), r3 = fract(seed * 7.73), r4 = fract(seed * 11.37);
            float order = clamp(aPiece.z / uLength, 0.0, 1.0) * 0.5 + clamp(aPiece.y / 520.0, 0.0, 1.0) * 0.12 + r1 * 0.1;
            vIn = clamp((uShow - order * 0.92) / 0.3, 0.0, 1.0);
            float away = pow(1.0 - vIn, 3.0);
            float side = aPiece.x > 10.0 ? 1.0 : (aPiece.x < -10.0 ? -1.0 : 0.0);
            vec3 off = side != 0.0
                ? vec3(side * (360.0 + 440.0 * r2), (r3 - 0.4) * 220.0, (r4 - 0.5) * 240.0)
                : (aPiece.y > 200.0 ? vec3((r2 - 0.5) * 160.0, 280.0 + 260.0 * r3, 0.0) : vec3(0.0, -80.0 - 60.0 * r3, 0.0));
            float turn = away * (1.0 + 2.4 * r4) * (side == 0.0 ? 0.3 : side) * (big > 1.5 ? 0.16 : (big > 0.5 ? 0.45 : 1.0));
            vec3 l = p - aPiece.xyz;
            float c = cos(turn), s = sin(turn);
            l.xy = vec2(c * l.x - s * l.y, s * l.x + c * l.y);
            float c2 = cos(turn * 0.7), s2 = sin(turn * 0.7);
            l.xz = vec2(c2 * l.x - s2 * l.z, s2 * l.x + c2 * l.z);
            return aPiece.xyz + l + off * away;
        }
    `;

    const VERTEX = `
        attribute vec3 aWall;
        attribute vec3 aRig;
        uniform float uWallScale;
        uniform float uRigScale;
        varying vec3 vWall;
        varying vec3 vRig;
        varying vec3 vWorld;
        varying vec3 vLocal;
        varying vec2 vUv;
        ${FLY}
        void main() {
            vWall = aWall * aWall * uWallScale; // stored as a square root, so the darks keep their detail
            vRig = aRig * aRig * uRigScale;
            vUv = uv;
            vLocal = position;
            vec4 w = modelMatrix * vec4(fly(position), 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
        }
    `;
    // LED panels are made here, not in Blender: they carry no baked light.
    const PANEL_VERTEX = `
        varying vec3 vWorld;
        varying vec2 vUv;
        ${FLY}
        void main() {
            vUv = uv;
            vec4 w = modelMatrix * vec4(fly(position), 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
        }
    `;

    const COMMON = `
        uniform vec3 uTint;       // colour of the light coming off the wall
        uniform float uWallGain;
        uniform float uRigGain;
        uniform float uTime;
        varying vec3 vWorld;
        varying vec2 vUv;
        varying float vIn;

        const vec3 COOL = vec3(0.56, 0.8, 1.0);    // the page's own white: a little blue
        const vec3 CYAN = vec3(0.32, 0.92, 0.9);

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        // Baked light is linear; what is written out is what the screen shows.
        vec3 screenOf(vec3 c) {
            c = c / (1.0 + c * 0.55);
            return pow(max(c, 0.0), vec3(0.4545));
        }
        // On its way in a piece glows, and cools as it locks into place.
        vec3 arrivingBy(vec3 col, float glow) {
            float hot = vIn * (1.0 - vIn) * 4.0;
            return col * smoothstep(0.0, 0.5, vIn) + CYAN * hot * glow;
        }
        vec3 arriving(vec3 col) { return arrivingBy(col, 0.5); }
    `;
    const BAKED = `
        varying vec3 vWall;
        varying vec3 vRig;
        varying vec3 vLocal;
    `;

    // Truss, towers, speakers, plinth: dark metal.
    const METAL_FRAGMENT = COMMON + BAKED + `
        void main() {
            if (vIn < 0.004) discard;
            vec3 V = normalize(cameraPosition - vWorld);
            vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
            float facing = abs(dot(n, V));
            float d = length(vWorld - cameraPosition);
            float rig = dot(vRig, vec3(0.3, 0.5, 0.2));
            // the wall's light, held back where it is strongest (the frame right beside the
            // screen would otherwise turn into a slab of the picture's colour)
            vec3 lit = vWall * uTint * uWallGain;
            float much = dot(lit, vec3(0.3, 0.5, 0.2));
            lit = mix(lit, vec3(much), smoothstep(0.08, 0.9, much) * 0.72) * (0.14 / (0.14 + much));
            vec3 col = lit + rig * COOL * uRigGain;
            // surfaces turning away from the eye catch a thin cool light: the truss reads as fine lines
            col += CYAN * pow(1.0 - facing, 2.5) * 0.03 * (0.35 + uWallGain);
            col = screenOf(col) * exp(-d * 0.0005);   // far pieces sink into the dark
            gl_FragColor = vec4(arriving(col), 1.0);
        }
    `;

    // Drawn among the stars without colour: it only hides the stars behind what has arrived.
    const MASK_FRAGMENT = `
        varying float vIn;
        void main() {
            if (vIn < 0.6) discard;
            gl_FragColor = vec4(0.0);
        }
    `;

    // The floor: a black mirror with the joints of a stage deck. It shows the wall, stretched
    // and softened, and the light that pools in front of it; everywhere else it is the dark.
    const FLOOR_FRAGMENT = COMMON + BAKED + `
        uniform sampler2D uPicA;
        uniform sampler2D uPicB;
        uniform float uMix;
        uniform vec4 uCropA;
        uniform vec4 uCropB;
        uniform vec3 uWallMin;   // the main screen, model units
        uniform vec3 uWallMax;
        uniform vec3 uOrigin;    // where the model stands in the world
        uniform float uSpan;     // length of the nave

        vec3 wallAt(vec2 suv, float soft) {
            vec3 a = texture2D(uPicA, suv * uCropA.xy + uCropA.zw, soft).rgb;
            vec3 b = texture2D(uPicB, suv * uCropB.xy + uCropB.zw, soft).rgb;
            return mix(a, b, uMix);
        }
        void main() {
            // no edge: it thins out to nothing toward its sides and ends
            float fade = smoothstep(325.0, 200.0, abs(vLocal.x)) * smoothstep(-58.0, -8.0, vLocal.z) * smoothstep(uSpan, uSpan - 300.0, vLocal.z) * vIn;
            if (fade < 0.004) discard;
            vec3 V = normalize(vWorld - cameraPosition);
            float d = length(vWorld - cameraPosition);
            float rig = dot(vRig, vec3(0.3, 0.5, 0.2));
            vec3 pool = vWall * uTint * uWallGain;
            vec3 col = pool * 0.3 + rig * COOL * uRigGain * 0.25;

            vec3 R = reflect(V, vec3(0.0, 1.0, 0.0));
            if (R.z < -0.001) {
                float t = (uOrigin.z + uWallMin.z - vWorld.z) / R.z;
                vec3 hit = vWorld + R * t - uOrigin;
                vec2 suv = (hit.xy - uWallMin.xy) / (uWallMax.xy - uWallMin.xy);
                float soft = 0.016 + t * 0.00018;
                // five taps up the wall: a reflection on a floor smears along the line of sight
                vec3 r = vec3(0.0);
                float total = 0.0;
                for (float i = -2.0; i <= 2.0; i += 1.0) {
                    vec2 p = suv + vec2(0.0, i * soft * 1.6);
                    float inside = smoothstep(0.0, soft, p.x) * smoothstep(0.0, soft, 1.0 - p.x)
                                 * smoothstep(-soft, soft, p.y) * smoothstep(-soft, soft * 3.0, 1.0 - p.y);
                    float wt = 1.0 - abs(i) * 0.28;
                    r += wallAt(clamp(p, 0.0, 1.0), 2.0 + t * 0.004) * inside * wt;
                    total += wt;
                }
                float fresnel = 0.08 + 0.92 * pow(1.0 - max(dot(-V, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
                // the mirror image is display-coded like the wall itself: bring it to light before adding
                vec3 mirror = pow(r / total, vec3(2.2)) * 2.6;
                col += mirror * fresnel * uWallGain * smoothstep(0.0, 60.0, t);
            }
            // deck joints, shown by the light that reaches them (they vanish before they would shimmer)
            vec2 g = vLocal.xz / 48.0;
            vec2 fw = fwidth(g);
            vec2 ln = 1.0 - smoothstep(vec2(0.0), fw * 1.6, abs(fract(g - 0.5) - 0.5));
            float joint = max(ln.x, ln.y) * (1.0 - smoothstep(0.03, 0.22, max(fw.x, fw.y)));
            col += (pool * 0.9 + CYAN * 0.006) * joint;

            // no glow of its own while the place assembles (it is far too large a surface): only its joints light up
            gl_FragColor = vec4(arrivingBy(screenOf(col), 0.2 * joint) * fade, 1.0);
        }
    `;

    // An LED panel of a screen: the picture as a lattice of emitters (they merge with distance),
    // and a change of picture that tears across in bands, like a wall switching content.
    const LED_FRAGMENT = COMMON + `
        uniform sampler2D uPicA;
        uniform sampler2D uPicB;
        uniform float uMix;
        uniform vec4 uCropA;
        uniform vec4 uCropB;
        uniform vec2 uGrid;      // emitters across and up
        void main() {
            if (vIn < 0.004) discard;
            vec2 uv = vUv;
            // bands switch one after another while the picture changes, each sliding a little
            float band = floor(uv.y * 26.0);
            float when = hash(vec2(band, 7.0));
            float sw = smoothstep(when * 0.7, when * 0.7 + 0.3, uMix);
            float busy = uMix * (1.0 - uMix) * 4.0;
            uv.x += (hash(vec2(band, floor(uTime * 20.0))) - 0.5) * 0.12 * busy * step(0.55, hash(vec2(band, 3.0)));
            vec3 a = texture2D(uPicA, uv * uCropA.xy + uCropA.zw).rgb;
            vec3 b = texture2D(uPicB, uv * uCropB.xy + uCropB.zw).rgb;
            vec3 pic = mix(a, b, sw);

            // the emitters show only while each one covers a few pixels; smaller than that they
            // would shimmer, so the picture goes smooth
            vec2 g = vUv * uGrid;
            float fine = max(fwidth(g.x), fwidth(g.y));
            float near = 1.0 - smoothstep(0.14, 0.34, fine);
            float dotMask = 1.0 - smoothstep(0.28, 0.5, length(fract(g) - 0.5));
            vec3 col = pic * mix(1.0, dotMask * 1.7, near) * 1.1;
            col += pic * busy * 0.3; // a flash while it switches
            // a faint line rolls up the wall, as on any big screen seen through a camera
            col *= 0.94 + 0.06 * sin(vUv.y * 90.0 - uTime * 2.2);
            gl_FragColor = vec4(arrivingBy(col * uWallGain, 0.26), 1.0);
        }
    `;

    const LENS_FRAGMENT = COMMON + `
        void main() {
            if (vIn < 0.004) discard;
            float flick = 0.86 + 0.14 * sin(uTime * 3.0 + vWorld.x * 0.21 + vWorld.z * 0.13);
            gl_FragColor = vec4(arriving(mix(COOL, uTint, 0.4) * 1.1 * flick * uWallGain), 1.0);
        }
    `;

    // Light spilling off the wall into the haze: a soft glow around the screen, drawn just in
    // front of it, so the truss stands dark against it.
    const HALO_VERTEX = `
        varying vec2 vAt;
        void main() {
            vAt = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    const HALO_FRAGMENT = `
        uniform vec3 uTint;
        uniform vec2 uHalf;      // half the screen's width and height
        uniform float uGain;
        varying vec2 vAt;
        void main() {
            vec2 q = abs(vAt) - uHalf;
            float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); // distance to the screen's edge, negative on it
            float away = max(d, 0.0);
            float glow = exp(-away / 46.0) * 0.07 + exp(-away / 190.0) * 0.06;
            glow *= smoothstep(-10.0, 4.0, d);                        // nothing over the picture itself
            vec3 tint = uTint / max(1.0, max(uTint.r, max(uTint.g, uTint.b)));
            gl_FragColor = vec4(tint * glow * uGain, 1.0);
        }
    `;

    // A beam of light in haze: a long cone, brightest through its middle as seen from the camera.
    const BEAM_VERTEX = `
        varying vec3 vNormalW;
        varying vec3 vWorld;
        varying float vAlong;
        void main() {
            vAlong = 1.0 - uv.y;   // 0 at the lamp, 1 at the far end
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
        }
    `;
    const BEAM_FRAGMENT = `
        uniform vec3 uTint;
        uniform float uGain;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        varying float vAlong;
        void main() {
            vec3 V = normalize(cameraPosition - vWorld);
            float facing = abs(dot(normalize(vNormalW), V));
            float core = pow(facing, 2.6);                 // thin at the outline, full through the middle
            float fall = pow(1.0 - vAlong, 1.7) * smoothstep(0.0, 0.04, vAlong);
            vec3 tint = uTint / max(1.0, max(uTint.r, max(uTint.g, uTint.b)));
            gl_FragColor = vec4(mix(tint, vec3(0.56, 0.8, 1.0), 0.5) * core * fall * uGain, 1.0);
        }
    `;

    const QUAD_VERTEX = `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `;
    const QUAD_FRAGMENT = `
        uniform sampler2D tVenue;
        varying vec2 vUv;
        void main() { gl_FragColor = vec4(texture2D(tVenue, vUv).rgb, 1.0); }
    `;

    const loadImage = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('picture not loaded: ' + src));
        img.src = src;
    });

    // The colour a picture throws into the room: its average, kept bright enough to light by.
    function lightOf(img) {
        const c = document.createElement('canvas');
        c.width = c.height = 8;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, 8, 8);
        const px = g.getImageData(0, 0, 8, 8).data;
        let r = 0, gr = 0, b = 0;
        for (let i = 0; i < px.length; i += 4) {
            r += Math.pow(px[i] / 255, 2.2); gr += Math.pow(px[i + 1] / 255, 2.2); b += Math.pow(px[i + 2] / 255, 2.2);
        }
        const n = px.length / 4;
        r /= n; gr /= n; b /= n;
        const lum = Math.max(0.0001, r * 0.2126 + gr * 0.7152 + b * 0.0722);
        // keep the hue, push it away from grey, and never let a dark picture leave the room black
        const level = Math.min(1.25, Math.max(0.7, 0.55 + lum * 3.2));
        const rich = (v) => Math.max(0.04, lum + (v - lum) * 1.5) / lum * level;
        return new THREE.Color(rich(r), rich(gr), rich(b));
    }

    // Scale and offset that fit a picture over a screen of another shape (it covers the screen,
    // cropped evenly). `slide` moves the crop across the picture: -1 its left part, 1 its right.
    function cropFor(picAspect, screenAspect, slide) {
        let sx = 1, sy = 1;
        if (picAspect > screenAspect) sx = screenAspect / picAspect; else sy = picAspect / screenAspect;
        return new THREE.Vector4(sx, sy, (1 - sx) * (0.5 + 0.5 * (slide || 0)), (1 - sy) * 0.5);
    }

    const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

    /* The pieces the model is made of: every run of triangles that hang together (a chord of an
       arch, a run of lacing, a speaker box) is one piece. Gives each vertex its piece's middle,
       length class and random number, as the aPiece attribute (see FLY). `ranges` are the index
       ranges to look at; vertices outside them, and those in `still`, stay put. */
    function findPieces(pos, q, index, ranges, still) {
        const n = pos.length / 3;
        const parent = new Uint32Array(n);
        const seen = new Map();
        for (let i = 0; i < n; i++) {
            // vertices at the same spot count as one, so a piece cut by a hard edge stays whole
            const key = q[i * 3] + q[i * 3 + 1] * 65536 + q[i * 3 + 2] * 4294967296;
            const first = seen.get(key);
            if (first === undefined) { seen.set(key, i); parent[i] = i; } else parent[i] = first;
        }
        const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
        const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
        const used = new Uint8Array(n);
        ranges.forEach(([start, count]) => {
            for (let i = start; i < start + count; i += 3) {
                join(index[i], index[i + 1]);
                join(index[i], index[i + 2]);
                used[index[i]] = used[index[i + 1]] = used[index[i + 2]] = 1;
            }
        });
        still.forEach(([start, count]) => { for (let i = start; i < start + count; i++) used[index[i]] = 0; });

        const box = new Map(); // piece -> [minx, miny, minz, maxx, maxy, maxz]
        for (let i = 0; i < n; i++) {
            if (!used[i]) continue;
            const r = find(i);
            let b = box.get(r);
            if (!b) { b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; box.set(r, b); }
            for (let k = 0; k < 3; k++) { const v = pos[i * 3 + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
        }
        const piece = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
            if (!used[i]) { piece[i * 4 + 3] = -1; continue; }
            const r = find(i), b = box.get(r);
            const long = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
            piece[i * 4] = (b[0] + b[3]) / 2;
            piece[i * 4 + 1] = (b[1] + b[4]) / 2;
            piece[i * 4 + 2] = (b[2] + b[5]) / 2;
            piece[i * 4 + 3] = (long > 170 ? 2 : long > 60 ? 1 : 0) + Math.min(0.999, Math.max(0.001, rand(r)));
        }
        return { piece, count: box.size };
    }

    class Venue {
        constructor(renderer, camera) {
            this.renderer = renderer;
            this.camera = camera;
            this.scene = new THREE.Scene();
            this.group = new THREE.Group();   // the place itself, drawn into its own picture
            this.scene.add(this.group);
            this.mask = new THREE.Group();    // the same shape without colour: main.js puts it among the stars
            this.mask.visible = false;
            this.ready = false;
            this.failed = false;
            this.wanted = false;   // main.js: should the place be on screen?
            this.show = 0;         // 0 to 1
            this.time = 0;
            this.pictures = [];    // { src, texture, aspect, light }
            this.at = -1;          // index of the picture on the wall
            this.mix = 1;          // 0 to 1 while one picture gives way to the next
            this.held = 0;         // seconds the current picture has been up
            this.tint = new THREE.Color(0.6, 0.85, 0.9);
            this.tintTo = this.tint.clone();
            this.materials = [];
            this.beams = [];
            this.loading = null;
            this.target = null;
            this.idle = 0;         // seconds since the place was last on screen
            this.webgl2 = !!renderer.capabilities.isWebGL2;
            const blank = new THREE.DataTexture(new Uint8Array([10, 14, 16, 255]), 1, 1, THREE.RGBAFormat);
            blank.needsUpdate = true;
            this.blank = { texture: blank, aspect: 1, light: this.tint.clone() };

            this.quadMaterial = new THREE.ShaderMaterial({
                uniforms: { tVenue: { value: null } },
                vertexShader: QUAD_VERTEX, fragmentShader: QUAD_FRAGMENT,
                blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false
            });
            const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quadMaterial);
            quad.frustumCulled = false;
            this.quadScene = new THREE.Scene();
            this.quadScene.add(quad);
            this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        }

        // Where the model's origin (the foot of the wall, on the centre line) stands in the world.
        place(x, y, z) {
            this.group.position.set(x, y, z);
            this.mask.position.set(x, y, z);
        }

        // url: the model's .json (its .bin sits beside it). srcs: pictures for the wall.
        load(url, srcs) {
            if (this.loading) return this.loading;
            this.loading = Promise.all([
                fetch(url).then((r) => { if (!r.ok) throw new Error('venue: ' + r.status); return r.json(); }),
                fetch(url.replace(/\.json(\?.*)?$/, '.bin$1')).then((r) => { if (!r.ok) throw new Error('venue: ' + r.status); return r.arrayBuffer(); })
            ]).then(([meta, bin]) => {
                this.build(meta, bin);
                this.ready = true;
                this.addPictures(srcs || []);
            }).catch((err) => {
                this.failed = true;
                throw err;
            });
            return this.loading;
        }

        addPictures(srcs) {
            srcs.forEach((src) => {
                loadImage(src).then((img) => {
                    const texture = new THREE.Texture(img);
                    texture.generateMipmaps = this.webgl2;
                    texture.minFilter = this.webgl2 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
                    texture.magFilter = THREE.LinearFilter;
                    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
                    texture.needsUpdate = true;
                    this.pictures.push({ src, texture, aspect: img.naturalWidth / img.naturalHeight, light: lightOf(img) });
                    if (this.at < 0) this.put(this.pictures.length - 1, true);
                }).catch(() => {});
            });
        }

        build(meta, bin) {
            const n = meta.vertexCount, s = meta.sections;
            const q = new Uint16Array(bin, s.position, n * 3);
            const min = meta.bounds.min, max = meta.bounds.max;
            const pos = new Float32Array(n * 3);
            for (let i = 0; i < n * 3; i++) pos[i] = min[i % 3] + (q[i] / 65535) * (max[i % 3] - min[i % 3]);
            const Index = n > 65535 ? Uint32Array : Uint16Array;
            const index = new Index(bin, s.index, meta.indexCount);

            // Screens are rebuilt below as panels; the model's own screen faces are left out.
            const solid = meta.groups.filter((g) => g.kind !== 'led');
            const pieces = findPieces(pos, q, index,
                solid.filter((g) => g.kind !== 'floor').map((g) => [g.start, g.count]),
                solid.filter((g) => g.kind === 'floor').map((g) => [g.start, g.count]));
            this.pieceCount = pieces.count;
            this.length = Math.max(1, max[2]);

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geometry.setAttribute('aWall', new THREE.BufferAttribute(new Uint8Array(bin, s.wall, n * 3), 3, true));
            geometry.setAttribute('aRig', new THREE.BufferAttribute(new Uint8Array(bin, s.rig, n * 3), 3, true));
            geometry.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(bin, s.uv, n * 2), 2, true));
            geometry.setAttribute('aPiece', new THREE.BufferAttribute(pieces.piece, 4));
            geometry.setIndex(new THREE.BufferAttribute(index, 1));

            const main = meta.screens[0];
            this.screens = meta.screens;
            this.shared = {
                uShow: { value: 0 },
                uLength: { value: this.length },
                uTint: { value: this.tint },
                uWallGain: { value: 1 },
                uRigGain: { value: 1 },
                uWallScale: { value: meta.wallScale || 1 },
                uRigScale: { value: meta.rigScale || 1 },
                uTime: { value: 0 },
                uMix: { value: 1 },
                uPicA: { value: this.blank.texture },
                uPicB: { value: this.blank.texture }
            };
            const make = (vertexShader, fragmentShader, extra, options) => {
                const m = new THREE.ShaderMaterial(Object.assign({
                    uniforms: Object.assign({}, this.shared, extra || {}), vertexShader, fragmentShader,
                    side: THREE.DoubleSide, extensions: { derivatives: true }
                }, options || {}));
                this.materials.push(m);
                return m;
            };
            this.crops = []; // every material that shows the picture, with the shape of its screen
            const withCrop = (vertexShader, fragmentShader, sc, slide, extra) => {
                const w = sc.max[0] - sc.min[0], h = sc.max[1] - sc.min[1];
                const m = make(vertexShader, fragmentShader, Object.assign({
                    uCropA: { value: new THREE.Vector4(1, 1, 0, 0) },
                    uCropB: { value: new THREE.Vector4(1, 1, 0, 0) },
                    uGrid: { value: new THREE.Vector2(Math.max(8, Math.round(w / 3)), Math.max(8, Math.round(h / 3))) }
                }, extra || {}));
                this.crops.push({ material: m, aspect: w / h, slide });
                return m;
            };

            // The model: floor, structure, lamp lenses.
            const unseen = new THREE.ShaderMaterial({ uniforms: this.shared, vertexShader: VERTEX, fragmentShader: MASK_FRAGMENT, side: THREE.DoubleSide, colorWrite: false });
            const list = [], hidden = [];
            solid.forEach((g) => {
                let m;
                if (g.kind === 'floor') {
                    m = withCrop(VERTEX, FLOOR_FRAGMENT, main, 0, {
                        uWallMin: { value: new THREE.Vector3().fromArray(main.min) },
                        uWallMax: { value: new THREE.Vector3().fromArray(main.max) },
                        uOrigin: { value: this.group.position },
                        uSpan: { value: this.length }
                    });
                } else if (g.kind === 'lens') {
                    m = make(VERTEX, LENS_FRAGMENT);
                } else {
                    m = make(VERTEX, METAL_FRAGMENT);
                }
                geometry.addGroup(g.start, g.count, list.length);
                list.push(m);
                hidden.push(g.kind === 'floor' ? null : unseen);
            });
            const mesh = new THREE.Mesh(geometry, list);
            mesh.frustumCulled = false;
            this.group.add(mesh);
            // the same triangles among the stars; the floor is left out (see the top of this file)
            const hideGeometry = new THREE.BufferGeometry();
            ['position', 'aWall', 'aRig', 'uv', 'aPiece'].forEach((name) => hideGeometry.setAttribute(name, geometry.getAttribute(name)));
            hideGeometry.setIndex(geometry.getIndex());
            solid.forEach((g) => { if (g.kind !== 'floor') hideGeometry.addGroup(g.start, g.count, 0); });
            const hide = new THREE.Mesh(hideGeometry, [unseen]);
            hide.frustumCulled = false;
            this.mask.add(hide);

            // The screens, as panels.
            const panels = this.buildPanels(meta.screens);
            const panelMaterials = meta.screens.map((sc, i) => withCrop(PANEL_VERTEX, LED_FRAGMENT, sc, i === 1 ? -0.8 : i === 2 ? 0.8 : 0));
            const wall = new THREE.Mesh(panels, panelMaterials);
            wall.frustumCulled = false;
            this.group.add(wall);
            const unseenPanel = new THREE.ShaderMaterial({ uniforms: this.shared, vertexShader: PANEL_VERTEX, fragmentShader: MASK_FRAGMENT, side: THREE.DoubleSide, colorWrite: false });
            const hideWall = new THREE.Mesh(panels, meta.screens.map(() => unseenPanel));
            hideWall.frustumCulled = false;
            this.mask.add(hideWall);

            // Glow in the haze around the main screen.
            const w = main.max[0] - main.min[0], h = main.max[1] - main.min[1];
            this.haloMaterial = new THREE.ShaderMaterial({
                uniforms: { uTint: { value: this.tint }, uHalf: { value: new THREE.Vector2(w / 2, h / 2) }, uGain: { value: 0 } },
                vertexShader: HALO_VERTEX, fragmentShader: HALO_FRAGMENT,
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
            });
            const halo = new THREE.Mesh(new THREE.PlaneGeometry(w + 700, h + 560), this.haloMaterial);
            halo.position.set((main.min[0] + main.max[0]) / 2, (main.min[1] + main.max[1]) / 2, main.max[2] + 3);
            halo.frustumCulled = false;
            halo.renderOrder = 2;
            this.group.add(halo);

            // Beams from the moving heads.
            const cone = new THREE.CylinderGeometry(0.05, 1, 1, 14, 1, true);
            cone.translate(0, -0.5, 0);        // the narrow end at the origin, opening downward
            this.beamMaterial = new THREE.ShaderMaterial({
                uniforms: { uTint: { value: this.tint }, uGain: { value: 0 } },
                vertexShader: BEAM_VERTEX, fragmentShader: BEAM_FRAGMENT,
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
            });
            const down = new THREE.Vector3(0, -1, 0);
            (meta.fixtures || []).slice(0, 16).forEach((f, i) => {
                const beam = new THREE.Mesh(cone, this.beamMaterial);
                beam.position.fromArray(f.pos);
                beam.scale.set(26, 330, 26);
                const aim = new THREE.Vector3().fromArray(f.dir).normalize();
                const rest = new THREE.Quaternion().setFromUnitVectors(down, aim);
                beam.quaternion.copy(rest);
                beam.frustumCulled = false;
                beam.renderOrder = 3;
                this.group.add(beam);
                this.beams.push({ mesh: beam, rest, phase: i * 1.7, swing: new THREE.Quaternion(), euler: new THREE.Euler() });
            });

            // Where stars may settle: points of the structure (see starPlaces).
            const spots = [];
            const taken = new Uint8Array(n);
            solid.forEach((g) => {
                if (g.kind !== 'baked') return;
                for (let i = g.start; i < g.start + g.count; i++) {
                    const v = index[i];
                    if (!taken[v]) { taken[v] = 1; spots.push(v); }
                }
            });
            this.spots = { pos, list: spots };
        }

        // One geometry holding every screen as a grid of panels, one material group per screen.
        // Each panel is a piece of its own, and carries its part of the screen's 0..1 picture.
        buildPanels(screens) {
            const P = [], UV = [], A = [], I = [];
            const geometry = new THREE.BufferGeometry();
            let seedAt = 1;
            screens.forEach((sc, si) => {
                const x0 = sc.min[0], y0 = sc.min[1], w = sc.max[0] - x0, h = sc.max[1] - y0, z = sc.max[2];
                const cols = Math.max(1, Math.round(w / PANEL)), rows = Math.max(1, Math.round(h / PANEL));
                const start = I.length, gap = 0.28;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const ax = x0 + w * c / cols, bx = x0 + w * (c + 1) / cols, ay = y0 + h * r / rows, by = y0 + h * (r + 1) / rows;
                        const cx = (ax + bx) / 2, cy = (ay + by) / 2, seed = Math.min(0.999, Math.max(0.001, rand(seedAt++ * 3.3)));
                        const base = P.length / 3;
                        [[ax + gap, ay + gap], [bx - gap, ay + gap], [bx - gap, by - gap], [ax + gap, by - gap]].forEach(([x, y]) => {
                            P.push(x, y, z);
                            UV.push((x - x0) / w, (y - y0) / h);
                            // a screen in the middle splits down its centre line: each half comes from its own side
                            A.push(Math.abs(cx) < 10 ? (c % 2 ? 11 : -11) : cx, cy, z, seed);
                        });
                        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
                    }
                }
                geometry.addGroup(start, I.length - start, si);
            });
            // the piece's middle steers both where it flies from and how it turns; a panel must turn about its own middle
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
            geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(UV), 2));
            geometry.setAttribute('aPiece', new THREE.BufferAttribute(new Float32Array(A), 4));
            geometry.setIndex(I);
            return geometry;
        }

        /* Places for `count` stars, in world units: a function for GPGPUStarfield.addFormation.
           About half the stars settle on the structure (so it sparkles and is drawn in stars
           before its pieces arrive); the rest keep drifting through the nave. */
        starPlaces() {
            const { pos, list } = this.spots, o = this.group.position;
            return (i) => {
                if (!list.length || rand(i * 1.37) > 0.52) return null;
                const v = list[Math.floor(rand(i * 2.71 + 5) * list.length) % list.length];
                const j = (k) => (rand(i * 3.3 + k) - 0.5) * 5;
                return [pos[v * 3] + o.x + j(1), pos[v * 3 + 1] + o.y + j(2), pos[v * 3 + 2] + o.z + j(3)];
            };
        }

        // Put picture `i` on the wall: at once, or torn in over the one that is there.
        put(i, atOnce) {
            const next = this.pictures[i];
            if (!next || !this.ready) return;
            const prev = this.at >= 0 ? this.pictures[this.at] : this.blank;
            this.at = i;
            this.held = 0;
            this.mix = atOnce ? 1 : 0;
            this.shared.uPicA.value = prev.texture;
            this.shared.uPicB.value = next.texture;
            this.crops.forEach((c) => {
                c.material.uniforms.uCropA.value.copy(cropFor(prev.aspect, c.aspect, c.slide));
                c.material.uniforms.uCropB.value.copy(cropFor(next.aspect, c.aspect, c.slide));
            });
            this.tintTo.copy(next.light);
            if (atOnce) this.tint.copy(next.light);
        }

        // On to the next picture now (a click in the place does this).
        next() {
            if (this.pictures.length > 1 && this.mix >= 1) this.put((this.at + 1) % this.pictures.length, false);
        }

        get visible() { return this.ready && this.show > 0.002; }

        update(dt) {
            if (!this.ready) return;
            this.time += dt;
            // it assembles in a little over two seconds, and flies apart faster
            this.show = this.wanted ? Math.min(1, this.show + dt / 2.3) : Math.max(0, this.show - dt / 0.9);
            const on = this.show > 0.002;
            this.mask.visible = on;
            if (!on) {
                // long gone: give back the memory its picture takes (it is made again when needed)
                this.idle += dt;
                if (this.idle > 12 && this.target) { this.target.dispose(); this.target = null; }
                return;
            }
            this.idle = 0;
            const u = this.shared;
            u.uShow.value = this.show;
            u.uTime.value = this.time;

            // The wall runs through the pictures by itself.
            this.held += dt;
            if (this.mix < 1) this.mix = Math.min(1, this.mix + dt / 0.9);
            else if (this.held > 6.5 && this.pictures.length > 1 && this.show > 0.98) this.put((this.at + 1) % this.pictures.length, false);
            u.uMix.value = this.mix;
            this.tint.lerp(this.tintTo, Math.min(1, dt * 2.2));
            // the wall's light comes up as its panels lock in; the room dips for a moment while it switches
            const lit = Math.min(1, Math.max(0, (this.show - 0.12) / 0.4));
            const dip = 1 - 0.35 * Math.sin(Math.min(1, this.mix) * Math.PI);
            u.uWallGain.value = lit * lit * (3 - 2 * lit) * dip;
            u.uRigGain.value = 1;

            const late = Math.min(1, Math.max(0, (this.show - 0.55) / 0.45));
            this.haloMaterial.uniforms.uGain.value = u.uWallGain.value * (0.35 + 0.65 * late);
            this.beamMaterial.uniforms.uGain.value = 0.13 * late * late * dip;
            for (const b of this.beams) {
                b.euler.set(Math.sin(this.time * 0.21 + b.phase) * 0.22, 0, Math.cos(this.time * 0.17 + b.phase * 1.3) * 0.22);
                b.mesh.quaternion.copy(b.rest).multiply(b.swing.setFromEuler(b.euler));
            }
        }

        // Size of the picture the place is drawn into: every pixel of the window, up to a limit.
        resize() {
            const buf = this.renderer.getDrawingBufferSize(new THREE.Vector2());
            const k = Math.min(1, 2560 / Math.max(buf.x, buf.y));
            const w = Math.max(2, Math.round(buf.x * k)), h = Math.max(2, Math.round(buf.y * k));
            if (this.target && this.target.width === w && this.target.height === h) return;
            if (this.target) { this.target.setSize(w, h); return; }
            // stencilBuffer: asks for the deeper kind of depth store; the plain one cannot tell a
            // screen from the frame behind it at the far end of the nave
            const options = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: true };
            if (this.webgl2 && THREE.WebGLMultisampleRenderTarget) {
                this.target = new THREE.WebGLMultisampleRenderTarget(w, h, options);
                this.target.samples = 4;
            } else {
                this.target = new THREE.WebGLRenderTarget(w, h, options);
            }
            this.quadMaterial.uniforms.tVenue.value = this.target.texture;
        }

        // Draw the place as the camera sees it now. Call before draw().
        render() {
            if (!this.visible) return;
            if (!this.target) this.resize();
            const r = this.renderer;
            r.setRenderTarget(this.target);
            r.render(this.scene, this.camera);
        }

        // Add it to the finished starfield in `target`.
        draw(target) {
            if (!this.visible || !this.target) return;
            const r = this.renderer, auto = r.autoClear;
            r.autoClear = false;
            r.setRenderTarget(target);
            r.render(this.quadScene, this.quadCamera);
            r.autoClear = auto;
        }
    }

    window.RelicVenue = Venue;
})();
