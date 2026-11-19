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
        varying vec3 vNormal;
        ${FLY}
        void main() {
            vNormal = normal;   // made smooth at load (computeVertexNormals); the model only moves, never turns
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
        uniform float uHaze;      // 0 to 1: how much haze hangs in the nave
        varying vec3 vWorld;
        varying vec2 vUv;
        varying float vIn;

        const vec3 COOL = vec3(0.56, 0.8, 1.0);    // the page's own white: a little blue
        const vec3 CYAN = vec3(0.32, 0.92, 0.9);

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        // value noise, for the wear of the metal and the deck (procedural: the model carries no texture coordinates)
        float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise3(vec3 x) {
            vec3 i = floor(x), f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(h3(i), h3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h3(i + vec3(0.0, 1.0, 0.0)), h3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                       mix(mix(h3(i + vec3(0.0, 0.0, 1.0)), h3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h3(i + vec3(0.0, 1.0, 1.0)), h3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
        }
        float fbm(vec3 p) {
            float a = 0.5, s = 0.0;
            for (int i = 0; i < 4; i++) { s += a * noise3(p); p = p * 2.03 + 17.1; a *= 0.5; }
            return s;
        }
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
        // Haze in three bands down the nave (P: model units, the wall at z = 0): the near end stays
        // dark and sharp, the middle sinks a little into a grey veil, the far end into the glow
        // around the wall. (The haze cards drawn across the nave veil the empty space the same way.)
        vec3 hazed(vec3 col, vec3 P) {
            float far = 1.0 - smoothstep(110.0, 430.0, P.z);
            float mid = (1.0 - far) * (1.0 - smoothstep(480.0, 760.0, P.z));
            vec3 tint = uTint / max(1.0, max(uTint.r, max(uTint.g, uTint.b)));
            vec2 q = abs(P.xy - vec2(0.0, 241.0)) - vec2(110.0, 195.0);
            float byWall = exp(-length(max(q, 0.0)) / 150.0);
            vec3 veil = COOL * 0.0025 * mid + tint * (0.002 + 0.028 * byWall) * far * uWallGain;
            float amt = (far * 0.5 + mid * 0.3) * uHaze;
            return mix(col, veil, amt);
        }
    `;
    // The picture on the main screen, for surfaces that mirror it (the floor, the metal).
    const PICTURE = `
        uniform sampler2D uPicA;
        uniform sampler2D uPicB;
        uniform float uMix;
        uniform vec4 uCropA;
        uniform vec4 uCropB;
        uniform vec3 uWallMin;   // the main screen, model units
        uniform vec3 uWallMax;
        uniform vec3 uOrigin;    // where the model stands in the world
        vec3 wallAt(vec2 suv, float soft) {
            vec3 a = texture2D(uPicA, suv * uCropA.xy + uCropA.zw, soft).rgb;
            vec3 b = texture2D(uPicB, suv * uCropB.xy + uCropB.zw, soft).rgb;
            return mix(a, b, uMix);
        }
    `;
    const BAKED = `
        varying vec3 vWall;
        varying vec3 vRig;
        varying vec3 vLocal;
    `;

    // Truss, towers, speakers, plinth: worn aluminium. Dark in itself; what makes it read as metal
    // is what it mirrors: the picture on the LED wall, smeared by the scuffed surface, and a faint
    // cool sheen from above. So the artwork stays the only colour in the place.
    const METAL_FRAGMENT = COMMON + PICTURE + BAKED + `
        varying vec3 vNormal;
        uniform sampler2D uMetalTex;   // worn aluminium, tileable (assets/3d/truss-aluminium.jpg)
        uniform float uMetalMean;      // its average brightness
        uniform float uTexOn;          // 0 until the textures have loaded
        uniform float uCoat;           // 1: black powder-coat (speakers, fixtures, bumpers, stage), 0: aluminium
        // On the structure (not the screens) vUv carries wear: u = dark steel hardware (couplers,
        // plates, chains), v = 1 a grille, 0.5 a worn bright edge (nosings).
        void main() {
            if (vIn < 0.004) discard;
            vec3 V = normalize(cameraPosition - vWorld);
            vec3 faceN = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
            vec3 n = dot(vNormal, vNormal) > 0.01 ? normalize(vNormal) : faceN;
            if (dot(n, V) < 0.0) n = -n;
            float facing = max(dot(n, V), 0.0);
            float d = length(vWorld - cameraPosition);

            // wear: big patches (some pieces older than others), fine scratches and pits, grime toward the floor
            float older = fbm(vLocal * 0.035);
            float fine = fbm(vLocal * 1.7);
            float pits = smoothstep(0.62, 0.8, noise3(vLocal * 5.0));
            float grime = smoothstep(90.0, 0.0, vLocal.y) * 0.5;
            float rough = clamp(0.02 + older * 0.3 + fine * 0.2 + grime * 0.3, 0.04, 0.9);
            float shine = (1.0 - rough) * (1.0 - pits * 0.6) * (1.0 - grime * 0.6);
            // the photo-like surface, projected from the three axes (the model has no texture
            // coordinates) and blended by which way the surface faces
            vec3 tw = pow(abs(n), vec3(4.0));
            tw /= tw.x + tw.y + tw.z;
            float ts = 1.0 / 34.0;
            float tex = texture2D(uMetalTex, vLocal.zy * ts).r * tw.x
                      + texture2D(uMetalTex, vLocal.xz * ts).r * tw.y
                      + texture2D(uMetalTex, vLocal.xy * ts).r * tw.z;
            float alb = mix(0.6 + 0.7 * fine, tex / uMetalMean, uTexOn);
            shine *= mix(1.0, smoothstep(0.25, 1.15, tex / uMetalMean), uTexOn);
            // steel hardware: darker and duller than the aluminium
            float steel = vUv.x;
            alb *= 1.0 - 0.45 * steel;
            shine *= 1.0 - 0.35 * steel;
            // worn edges: on a round chord the rim turned across the view is where it is polished by use
            float rim = pow(1.0 - facing, 1.6) * smoothstep(0.35, 0.75, fine + older * 0.4);
            float edge = step(0.4, vUv.y) * step(vUv.y, 0.6);
            alb *= 1.0 + rim * 0.4 * (1.0 - uCoat) + edge * 0.8;
            // powder-coat: black satin with a soft broad sheen, chipped to bare metal here and there
            float chip = smoothstep(0.8, 0.88, noise3(vLocal * 0.9 + 3.1)) * (0.4 + rim);
            alb = mix(alb, 0.3 + 0.35 * chip * alb, uCoat);
            shine = mix(shine, 0.2 + 0.22 * fine + chip * 0.5, uCoat);
            rough = mix(rough, 0.55, uCoat);
            // grilles: a perforated sheet; the holes merge into a flat dark grey with distance
            float gr = step(0.75, vUv.y);
            vec2 hp = vec2(vLocal.x, vLocal.y + vLocal.z * 0.5) * 1.4;
            float holeFine = max(fwidth(hp.x), fwidth(hp.y));
            float hole = 1.0 - smoothstep(0.22, 0.34, length(fract(hp) - 0.5));
            hole = mix(hole, 0.35, smoothstep(0.25, 0.6, holeFine));
            alb *= 1.0 - gr * (0.25 + 0.6 * hole);
            shine *= 1.0 - gr * 0.7;

            float rig = dot(vRig, vec3(0.3, 0.5, 0.2));
            // the wall's light, held back where it is strongest (the frame right beside the
            // screen would otherwise turn into a slab of the picture's colour)
            vec3 lit = vWall * uTint * uWallGain;
            float much = dot(lit, vec3(0.3, 0.5, 0.2));
            lit = mix(lit, vec3(much), smoothstep(0.08, 0.9, much) * 0.6) * (1.5 / (1.0 + much * 6.0));
            // the sky's cool light, mostly kept off faces that look straight up (wide plates turned teal)
            float skyUp = 1.0 - 0.7 * smoothstep(0.3, 0.9, n.y);
            vec3 col = (lit + rig * mix(vec3(0.75), COOL, 0.35 * skyUp) * skyUp * uRigGain * 0.4) * alb * (1.0 - grime * 0.5);

            // what it mirrors: the screen, blurred by how rough this spot is; around it the glow in the haze
            vec3 R = reflect(-V, n);
            vec3 P = vWorld - uOrigin;
            vec3 spec = vec3(0.0);
            if (R.z < -0.001) {
                float t = (uWallMin.z - P.z) / R.z;
                vec2 suv = (P.xy + R.xy * t - uWallMin.xy) / (uWallMax.xy - uWallMin.xy);
                vec2 q = abs(suv - 0.5) - 0.5;
                float miss = length(max(q, 0.0));
                float soft = 0.02 + rough * 0.3;
                float inside = 1.0 - smoothstep(0.0, soft, miss);
                vec3 pic = pow(wallAt(clamp(suv, 0.0, 1.0), 2.0 + rough * 7.0 + t * 0.004), vec3(2.2));
                vec3 tint = uTint / max(1.0, max(uTint.r, max(uTint.g, uTint.b)));
                spec = pic * inside * 1.6 + tint * exp(-miss * 5.0) * 0.012;
            }
            // a cool sheen from above, so the metal reads in the dark half of the nave too
            spec += mix(vec3(0.7), COOL, 0.4) * smoothstep(0.2, 1.0, R.y) * 0.014 * (1.0 - 0.75 * smoothstep(0.5, 0.95, n.y)); // kept off wide flat plates, which went teal
            float fresnel = 0.55 + 0.45 * pow(1.0 - facing, 5.0);
            col += spec * fresnel * shine * uWallGain;

            // the line of light that runs along a polished tube: one from the wall (its colour),
            // one cool from high behind the camera. Broken up where the metal is worn.
            float pw = mix(56.0, 10.0, rough);   // broad enough to cover a thin tube's few pixels
            vec3 toWall = vec3(0.0, 0.5 * (uWallMin.y + uWallMax.y), uWallMin.z) - P;
            float near = 1.0 / (1.0 + dot(toWall, toWall) * 0.000004);
            vec3 Lw = normalize(toWall);
            float sw = pow(max(dot(n, normalize(Lw + V)), 0.0), pw) * (pw * 0.03 + 0.3);
            vec3 Lc = normalize(vec3(0.25, 1.0, 0.8));
            float sc = pow(max(dot(n, normalize(Lc + V)), 0.0), pw) * (pw * 0.03 + 0.3);
            vec3 tintW = uTint / max(1.0, max(uTint.r, max(uTint.g, uTint.b)));
            col += (tintW * sw * 2.4 * near * uWallGain + COOL * sc * 0.24) * shine * (0.4 + 0.6 * alb);
            // faces turned to the wall take its colour as a soft rim, fading down the nave
            float faceW = max(dot(n, Lw), 0.0);
            float reach = 1.0 / (1.0 + dot(toWall, toWall) * 0.0000025);
            col += tintW * faceW * faceW * reach * 0.07 * uWallGain * (0.5 + 0.5 * alb) * (1.0 - smoothstep(0.6, 0.95, n.y));
            // a low cool kicker along the pier feet, so the bases read against the black floor
            float low = 1.0 - smoothstep(4.0, 70.0, P.y);
            col += COOL * low * pow(max(dot(n, normalize(vec3(0.0, 0.25, 1.0))), 0.0), 1.5) * 0.035 * (0.35 + uWallGain) * (1.0 - smoothstep(0.5, 0.9, n.y));

            // surfaces turning away from the eye catch a thin cool light: the truss reads as fine lines
            // (not on faces that look up: seen at a grazing angle, the wide base plates turned into teal slabs)
            col += CYAN * pow(1.0 - facing, 2.5) * 0.03 * (0.35 + uWallGain) * (1.0 - uCoat * 0.6) * (1.0 - smoothstep(0.45, 0.85, n.y));
            // the nearest towers stand darkest, as silhouettes against the hazy light further in
            col *= 1.0 - 0.3 * smoothstep(520.0, 870.0, P.z);
            col = hazed(col, P);
            col = screenOf(col) * exp(-d * 0.0002);
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
    const FLOOR_FRAGMENT = COMMON + PICTURE + BAKED + `
        uniform float uSpan;     // length of the nave
        uniform sampler2D uDeckTex;   // one painted deck's surface, tileable (assets/3d/stage-deck.jpg)
        uniform float uDeckMean;
        uniform float uTexOn;
        // The wall's light on the floor, baked into a picture (it holds the lattice's shadows, which
        // the vertices cannot): square-root coded, times uMapScale. Until it loads: the vertices.
        uniform sampler2D uFloorMap;
        uniform vec4 uMapBox;         // x min, z min, x max, z max (model units)
        uniform float uMapScale;
        uniform float uMapOn;

        void main() {
            // no edge: it thins out to nothing toward its sides and ends
            float fade = smoothstep(458.0, 330.0, abs(vLocal.x)) * smoothstep(-58.0, -8.0, vLocal.z) * smoothstep(uSpan, uSpan - 300.0, vLocal.z) * vIn;
            if (fade < 0.004) discard;
            vec3 V = normalize(vWorld - cameraPosition);
            float d = length(vWorld - cameraPosition);
            float rig = dot(vRig, vec3(0.3, 0.5, 0.2));
            vec2 muv = (vLocal.xz - uMapBox.xy) / (uMapBox.zw - uMapBox.xy);
            float mv = texture2D(uFloorMap, muv).r;
            vec3 wallLight = mix(vWall, vec3(mv * mv * uMapScale), uMapOn);
            // behind the closing block's words and buttons the floor stays quiet: a band down the
            // middle of the nave, from a little in front of the stage to the camera
            float band = smoothstep(135.0, 35.0, abs(vLocal.x)) * smoothstep(110.0, 420.0, vLocal.z);
            vec3 pool = wallLight * uTint * uWallGain * (1.0 - 0.45 * band);

            // stage decks, 2 m by 1 m (40 by 20 units), every other row set half a deck over;
            // each deck its own age: some glossy, some dull, all scuffed where people walk
            float row = floor(vLocal.z / 20.0);
            vec2 dk = vec2(vLocal.x + mod(row, 2.0) * 20.0, vLocal.z) / vec2(40.0, 20.0);
            vec2 cell = floor(dk);
            float age = hash(cell + 3.7);
            float scuff = fbm(vec3(vLocal.xz * vec2(0.09, 0.03), age * 9.0));
            float grain = fbm(vec3(vLocal.xz * 0.8, 1.3));
            float walk = smoothstep(150.0, 20.0, abs(vLocal.x));        // the aisle wears most
            // each deck shows its own part of the deck texture, some turned round, so it never visibly repeats
            vec2 duv = (vec2(vLocal.x + mod(row, 2.0) * 20.0, vLocal.z) + vec2(hash(cell + 1.1), hash(cell + 2.3)) * 400.0) / 40.0;
            duv.x *= step(0.5, hash(cell + 5.5)) * 2.0 - 1.0;
            float deck = mix(1.0, texture2D(uDeckTex, duv).r / uDeckMean, uTexOn);
            float dull = clamp(0.15 + age * 0.45 + scuff * 0.5 * (0.5 + walk) - 0.25 + (deck - 1.0) * 0.35, 0.0, 1.0);
            float gloss = 1.0 - dull * 0.75;
            // the deck takes the wall's light (and the lattice's shadows in it) more strongly out of the middle band
            float lift = mix(2.4, 0.85, band);
            vec3 col = (pool * (0.22 + 0.14 * grain + 0.1 * dull) * lift + rig * COOL * uRigGain * (0.08 + 0.06 * grain)) * mix(1.0, deck, 0.8);

            vec3 R = reflect(V, vec3(0.0, 1.0, 0.0));
            if (R.z < -0.001) {
                float t = (uOrigin.z + uWallMin.z - vWorld.z) / R.z;
                vec3 hit = vWorld + R * t - uOrigin;
                vec2 suv = (hit.xy - uWallMin.xy) / (uWallMax.xy - uWallMin.xy);
                float soft = (0.012 + t * 0.00016) * (1.0 + dull * 1.6);
                // five taps up the wall: a reflection on a floor smears along the line of sight
                vec3 r = vec3(0.0);
                float total = 0.0;
                for (float i = -2.0; i <= 2.0; i += 1.0) {
                    vec2 p = suv + vec2(0.0, i * soft * 1.6);
                    float inside = smoothstep(0.0, soft, p.x) * smoothstep(0.0, soft, 1.0 - p.x)
                                 * smoothstep(-soft, soft, p.y) * smoothstep(-soft, soft * 3.0, 1.0 - p.y);
                    float wt = 1.0 - abs(i) * 0.28;
                    r += wallAt(clamp(p, 0.0, 1.0), 2.0 + t * 0.004 + dull * 2.5) * inside * wt;
                    total += wt;
                }
                float fresnel = 0.08 + 0.92 * pow(1.0 - max(dot(-V, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
                // the mirror image is display-coded like the wall itself: bring it to light before adding
                vec3 mirror = pow(r / total, vec3(2.2)) * 2.6;
                col += mirror * fresnel * gloss * (0.85 + 0.3 * grain) * uWallGain * smoothstep(0.0, 60.0, t) * (1.0 - 0.45 * band); // a long streak of the wall runs down the aisle
            }
            // deck joints: a dark seam with a lit bevel on its far side (they vanish before they would shimmer)
            vec2 fw = fwidth(dk);
            vec2 e = abs(fract(dk - 0.5) - 0.5);
            vec2 ln = 1.0 - smoothstep(vec2(0.0), fw * 1.6, e);
            float fade2 = 1.0 - smoothstep(0.03, 0.22, max(fw.x, fw.y));
            // the seams across the nave are kept fainter: at this angle they lined up as even stripes
            float joint = max(ln.x, ln.y * (0.3 + 0.3 * age)) * fade2;
            float bevel = (1.0 - smoothstep(fw.y * 1.6, fw.y * 4.0, fract(dk.y))) * step(fw.y * 1.6, fract(dk.y)) * fade2;
            col *= 1.0 - joint * 0.7;
            col += (pool * 0.8 + CYAN * 0.004) * bevel * (0.2 + 0.5 * age);
            // spike tape left from earlier shows: small grey-white marks at a few deck corners
            vec2 tc = fract(dk) - vec2(0.12, 0.2);
            float taped = step(0.86, hash(cell + 9.1)) * (1.0 - band);
            float tape = max(step(abs(tc.x), 0.02) * step(abs(tc.y), 0.12), step(abs(tc.y), 0.04) * step(abs(tc.x), 0.08));
            tape *= taped * fade2;
            col += (pool * 0.5 + rig * COOL * 0.03 + vec3(0.002)) * tape * (0.6 + 0.4 * scuff);
            col = hazed(col, vLocal);

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
        uniform vec2 uPanels;    // panels across and up (their seams show while they are big enough)
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
            // module seams: a hairline between panels, a fainter one across the middle of each;
            // gone before they are thin enough to shimmer
            vec2 pg = vUv * uPanels;
            vec2 pf = fwidth(pg);
            vec2 se = 0.5 - abs(fract(pg) - 0.5);
            float seamOn = 1.0 - smoothstep(0.03, 0.09, max(pf.x, pf.y));
            float seam = max(1.0 - smoothstep(0.0, pf.x * 1.2, se.x), 1.0 - smoothstep(0.0, pf.y * 1.2, se.y));
            float mid = 1.0 - smoothstep(0.0, pf.y * 2.4, abs(fract(pg.y) - 0.5));
            col *= 1.0 - (seam * 0.22 + mid * 0.05) * seamOn; // light enough that the picture reads first
            // a faint line rolls up the wall, as on any big screen seen through a camera
            col *= 0.94 + 0.06 * sin(vUv.y * 90.0 - uTime * 2.2);
            gl_FragColor = vec4(arrivingBy(col * uWallGain, 0.26), 1.0);
        }
    `;

    const LENS_FRAGMENT = COMMON + `
        void main() {
            if (vIn < 0.004) discard;
            // a small static white glint on each lamp's glass, low level
            gl_FragColor = vec4(arriving(mix(vec3(1.0), COOL, 0.35) * 0.62 * (0.4 + 0.6 * uWallGain)), 1.0);
        }
    `;

    // The thin white light along the stage's lip: steady, cool white, low.
    const GLOW_FRAGMENT = COMMON + `
        void main() {
            if (vIn < 0.004) discard;
            gl_FragColor = vec4(arrivingBy(vec3(0.78, 0.88, 1.0) * 0.85, 0.3), 1.0);
        }
    `;

    // Shafts of the wall's light in the haze, fanning out from the screen through the lattice:
    // long soft strips that always turn their face to the camera (about their own axis).
    const SHAFT_VERTEX = `
        attribute vec3 aFrom;     // where the shaft leaves the wall
        attribute vec3 aTo;       // where it has faded out
        attribute vec3 aShape;    // x: along (0 at the wall, 1 at the end), y: across (-1..1), z: its own random number
        uniform vec2 uWidth;      // half width at the wall, at the end
        varying vec2 vAt;
        varying float vSeed;
        varying vec3 vModel;
        void main() {
            vec3 p = mix(aFrom, aTo, aShape.x);
            vec3 axis = normalize(aTo - aFrom);
            vec3 w = (modelMatrix * vec4(p, 1.0)).xyz;
            vec3 toCam = normalize(cameraPosition - w);
            vec3 side = normalize(cross(axis, toCam));
            float half_ = mix(uWidth.x, uWidth.y, aShape.x) * (0.75 + 0.5 * aShape.z);
            p += side * half_ * aShape.y;
            vAt = aShape.xy;
            vSeed = aShape.z;
            vModel = p;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
        }
    `;
    const SHAFT_FRAGMENT = `
        uniform vec3 uTint;
        uniform float uGain;
        uniform float uTime;
        varying vec2 vAt;
        varying float vSeed;
        varying vec3 vModel;
        void main() {
            float across = 1.0 - abs(vAt.y);
            float core = across * across * (3.0 - 2.0 * across);
            float along = smoothstep(0.0, 0.06, vAt.x) * pow(1.0 - vAt.x, 1.6);
            // broken by the lattice it passes through: soft gaps along its length, drifting slowly
            float gaps = 0.62 + 0.38 * sin(vAt.x * 38.0 + vSeed * 20.0 + sin(uTime * 0.13 + vSeed * 6.0) * 1.5);
            float breathe = 0.75 + 0.25 * sin(uTime * (0.11 + vSeed * 0.07) + vSeed * 40.0);
            // never in front of the words: shafts fade out where they come low over the floor near the camera
            float low = smoothstep(60.0, 190.0, vModel.y) + smoothstep(140.0, 230.0, abs(vModel.x));
            vec3 tint = uTint / max(1.0, max(uTint.r, max(uTint.g, uTint.b)));
            vec3 col = mix(tint, vec3(0.56, 0.8, 1.0), 0.25) * core * along * gaps * breathe * min(1.0, low) * uGain;
            gl_FragColor = vec4(col, 1.0);
        }
    `;

    // Haze cards: sheets of lit air standing across the nave. Each adds a little of the wall's
    // light, most near the wall's axis and at mid height, so whatever stands behind a card is
    // veiled by it and whatever stands in front is not: three depth bands for the cost of three quads.
    const HAZE_VERTEX = `
        varying vec3 vAt;
        void main() {
            vAt = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
    const HAZE_FRAGMENT = `
        uniform vec3 uTint;
        uniform float uGain;
        uniform float uZ;         // where this card stands (model units from the wall)
        varying vec3 vAt;
        void main() {
            float r = length(vec2(vAt.x * 0.8, (vAt.y - 230.0) * 1.0));
            float glow = exp(-r / (150.0 + uZ * 0.35)) * 0.8 + exp(-r / 420.0) * 0.2;
            float edge = smoothstep(440.0, 300.0, abs(vAt.x)) * smoothstep(0.0, 40.0, vAt.y) * smoothstep(620.0, 420.0, vAt.y);
            vec3 tint = uTint / max(1.0, max(uTint.r, max(uTint.g, uTint.b)));
            vec3 col = mix(tint, vec3(0.56, 0.8, 1.0), 0.2 + uZ / 1400.0) * glow * edge * uGain;
            gl_FragColor = vec4(col, 1.0);
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

    /* The same, from the piece number every vertex carries (models from 2026-11-18 on): a truss
       section, with its couplers, chains and plates, flies in as one. Piece 0 stays put. */
    function piecesFromIds(pos, ids) {
        const n = ids.length;
        const box = new Map();
        for (let i = 0; i < n; i++) {
            const id = ids[i];
            if (!id) continue;
            let b = box.get(id);
            if (!b) { b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; box.set(id, b); }
            for (let k = 0; k < 3; k++) { const v = pos[i * 3 + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; }
        }
        const piece = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
            const id = ids[i];
            if (!id) { piece[i * 4 + 3] = -1; continue; }
            const b = box.get(id);
            const long = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
            piece[i * 4] = (b[0] + b[3]) / 2;
            piece[i * 4 + 1] = (b[1] + b[4]) / 2;
            piece[i * 4 + 2] = (b[2] + b[5]) / 2;
            piece[i * 4 + 3] = (long > 170 ? 2 : long > 60 ? 1 : 0) + Math.min(0.999, Math.max(0.001, rand(id * 1.618)));
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
                this.addSurfaces(url);
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

        // The surface textures (they sit beside the model). Until they arrive, and if they fail,
        // the shaders use their own procedural wear.
        addSurfaces(url) {
            const dir = url.replace(/[^/]*$/, '');
            const brightness = (img) => {
                const c = document.createElement('canvas');
                c.width = c.height = 16;
                const g = c.getContext('2d');
                g.drawImage(img, 0, 0, 16, 16);
                const px = g.getImageData(0, 0, 16, 16).data;
                let sum = 0;
                for (let i = 0; i < px.length; i += 4) sum += px[i];
                return Math.max(0.02, sum / (px.length / 4) / 255);
            };
            const one = (file) => loadImage(dir + file).then((img) => {
                const t = new THREE.Texture(img);
                t.wrapS = t.wrapT = THREE.RepeatWrapping;
                t.minFilter = THREE.LinearMipmapLinearFilter;
                t.magFilter = THREE.LinearFilter;
                t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
                t.needsUpdate = true;
                return { t, mean: brightness(img) };
            });
            Promise.all([one('truss-aluminium.jpg'), one('stage-deck.jpg')]).then(([metal, deck]) => {
                const u = this.shared;
                u.uMetalTex.value = metal.t; u.uMetalMean.value = metal.mean;
                u.uDeckTex.value = deck.t; u.uDeckMean.value = deck.mean;
                u.uTexOn.value = 1;
            }).catch(() => {});
            // the floor's light map (it carries the version of the model's address, so it changes with it)
            if (this.floorMap) {
                const ver = (url.match(/\?.*$/) || [''])[0];
                loadImage(dir + this.floorMap.src + ver).then((img) => {
                    const t = new THREE.Texture(img);
                    t.flipY = false;                 // row 0 of the picture is the far end (z min)
                    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
                    t.generateMipmaps = this.webgl2;  // 1024 x 1280: mipmaps need WebGL2
                    t.minFilter = this.webgl2 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
                    t.magFilter = THREE.LinearFilter;
                    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
                    t.needsUpdate = true;
                    this.shared.uFloorMap.value = t;
                    this.shared.uMapOn.value = 1;
                }).catch(() => {});
            }
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
            const pieces = s.piece !== undefined
                ? piecesFromIds(pos, new Uint16Array(bin, s.piece, n))
                : findPieces(pos, q, index,
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
            geometry.computeVertexNormals(); // round tubes shade round; hard edges are split vertices in the model

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
                uPicB: { value: this.blank.texture },
                uMetalTex: { value: this.blank.texture },
                uDeckTex: { value: this.blank.texture },
                uMetalMean: { value: 1 },
                uDeckMean: { value: 1 },
                uTexOn: { value: 0 },
                uHaze: { value: 1 },
                uFloorMap: { value: this.blank.texture },
                uMapOn: { value: 0 }
            };
            const fm = meta.floorMap;
            this.floorMap = fm || null;
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
                    uGrid: { value: new THREE.Vector2(Math.max(8, Math.round(w / 3)), Math.max(8, Math.round(h / 3))) },
                    uPanels: { value: new THREE.Vector2(Math.max(1, Math.round(w / PANEL)), Math.max(1, Math.round(h / PANEL))) }
                }, extra || {}));
                this.crops.push({ material: m, aspect: w / h, slide });
                return m;
            };

            // The model: floor, structure, lamp lenses.
            const unseen = new THREE.ShaderMaterial({ uniforms: this.shared, vertexShader: VERTEX, fragmentShader: MASK_FRAGMENT, side: THREE.DoubleSide, colorWrite: false });
            const list = [], hidden = [];
            const mirrorOf = () => ({
                uWallMin: { value: new THREE.Vector3().fromArray(main.min) },
                uWallMax: { value: new THREE.Vector3().fromArray(main.max) },
                uOrigin: { value: this.group.position }
            });
            let metal = null, coat = null; // one material for the aluminium, one for the black powder-coat
            solid.forEach((g) => {
                let m;
                if (g.kind === 'floor') {
                    m = withCrop(VERTEX, FLOOR_FRAGMENT, main, 0, Object.assign(mirrorOf(), {
                        uSpan: { value: this.length },
                        uMapBox: { value: fm ? new THREE.Vector4(fm.min[0], fm.min[1], fm.max[0], fm.max[1]) : new THREE.Vector4(-1, -1, 1, 1) },
                        uMapScale: { value: fm ? fm.scale : 0 }
                    }));
                } else if (g.kind === 'lens') {
                    m = make(VERTEX, LENS_FRAGMENT);
                } else if (g.kind === 'glow') {
                    m = make(VERTEX, GLOW_FRAGMENT);
                } else if (g.kind === 'coat') {
                    m = coat || (coat = withCrop(VERTEX, METAL_FRAGMENT, main, 0, Object.assign(mirrorOf(), { uCoat: { value: 1 } })));
                } else {
                    m = metal || (metal = withCrop(VERTEX, METAL_FRAGMENT, main, 0, Object.assign(mirrorOf(), { uCoat: { value: 0 } })));
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

            // Haze cards across the nave (see HAZE_FRAGMENT): nearer cards are fainter.
            this.hazeCards = [];   // one veil at each arch: the nave reads in steps of air
            [[150, 0.022], [290, 0.017], [430, 0.012], [570, 0.008], [710, 0.005]].forEach(([z, gain], i) => {
                const m = new THREE.ShaderMaterial({
                    uniforms: { uTint: { value: this.tint }, uGain: { value: 0 }, uZ: { value: z } },
                    vertexShader: HAZE_VERTEX, fragmentShader: HAZE_FRAGMENT,
                    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
                });
                const card = new THREE.Mesh(new THREE.PlaneGeometry(900, 640), m);
                card.geometry.translate(0, 320, 0);
                card.position.set(0, 0, z);
                card.frustumCulled = false;
                card.renderOrder = 2;
                this.group.add(card);
                this.hazeCards.push({ material: m, gain });
            });

            // Shafts of the wall's light in the haze, fanning out through the lattice to the sides and
            // overhead (none comes low down the middle, where the words are).
            this.shaftMaterial = new THREE.ShaderMaterial({
                uniforms: { uTint: { value: this.tint }, uGain: { value: 0 }, uTime: this.shared.uTime, uWidth: { value: new THREE.Vector2(10, 70) } },
                vertexShader: SHAFT_VERTEX, fragmentShader: SHAFT_FRAGMENT,
                transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
            });
            const shafts = this.buildShafts(main);
            const shaftMesh = new THREE.Mesh(shafts, this.shaftMaterial);
            shaftMesh.frustumCulled = false;
            shaftMesh.renderOrder = 2;
            this.group.add(shaftMesh);

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
                beam.scale.set(16, 330, 16);
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
                    if (taken[v]) continue;
                    taken[v] = 1;
                    // few on the feet and plates: the lower third stays calm under the closing words
                    if (pos[v * 3 + 1] < 40 && v % 4) continue;
                    spots.push(v);
                }
            });
            this.spots = { pos, list: spots };
        }

        // The light shafts: each a strip of 8 segments from a point on the main screen out into the nave.
        buildShafts(main) {
            const F = [], T = [], S = [], I = [];
            const cx = (main.min[0] + main.max[0]) / 2, w = main.max[0] - main.min[0], h = main.max[1] - main.min[1];
            const list = [];
            for (let side = -1; side <= 1; side += 2) {
                for (let k = 0; k < 5; k++) {
                    const r = rand(k * 7.1 + side * 3.3 + 11);
                    const fx = cx + side * w * (0.12 + 0.32 * rand(k * 2.3 + side));
                    const fy = main.min[1] + h * (0.35 + 0.55 * rand(k * 4.9 + side * 2));
                    // out to the side bays and up into the arches, never low down the middle
                    const tx = side * (170 + 170 * rand(k * 1.7 + side * 5));
                    const ty = 120 + 420 * rand(k * 3.1 + side * 9);
                    const tz = 520 + 280 * rand(k * 5.3 + side);
                    list.push([[fx, fy, main.max[2] + 2], [tx, ty, tz], r]);
                }
            }
            list.forEach(([from, to, seed]) => {
                const base = F.length / 3;
                const N = 8;
                for (let i = 0; i <= N; i++) {
                    for (const y of [-1, 1]) {
                        F.push(from[0], from[1], from[2]);
                        T.push(to[0], to[1], to[2]);
                        S.push(i / N, y, seed);
                    }
                }
                for (let i = 0; i < N; i++) {
                    const a = base + i * 2;
                    I.push(a, a + 1, a + 3, a, a + 3, a + 2);
                }
            });
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(F), 3)); // (moved in the shader)
            g.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(F), 3));
            g.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(T), 3));
            g.setAttribute('aShape', new THREE.BufferAttribute(new Float32Array(S), 3));
            g.setIndex(I);
            return g;
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
            this.beamMaterial.uniforms.uGain.value = 2.2 * late * late * dip;
            this.shaftMaterial.uniforms.uGain.value = 0.07 * late * late * dip;
            const air = u.uWallGain.value * (0.4 + 0.6 * late) * u.uHaze.value;
            this.hazeCards.forEach((c) => { c.material.uniforms.uGain.value = c.gain * air; });
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
