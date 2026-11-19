/* Relic Studios — the live 3D background behind every page.
   Needs three.js r128, GPUComputationRenderer, GPGPUStarfield, SimpleBloomComposer and
   (optionally) ArtStage, all loaded before this file. If any required part is missing, or
   WebGL is unavailable, the page simply keeps its black background.

   What happens here:
   - The stars drift as one cloud on the home page and gather into shapes as the reader moves
     through sections: js/site.js sends a `relic:form` event with the shape name, and each
     shape has its own camera position below.
   - A section can name a picture instead of a shape (form "art"). The stars then gather into
     the picture and it burns in as a 3D relief (js/artscene.js). Pointer and scroll move the
     camera around it.
   - The whole picture reacts to the visitor: stars swerve away from the pointer, the image
     ripples where the pointer has been and stretches while the page scrolls fast
     (js/simple-bloom.js). With reduced motion all of this is off and pictures are plain images. */
(function () {
    'use strict';

    const container = document.getElementById('canvas-container');
    if (!container || !window.THREE || !window.GPGPUStarfield) return;

    if (/[?&]scene=off/.test(location.search)) return; // debugging aid: page without the 3D layer

    const root = document.documentElement;
    const reduced = root.classList.contains('motion-reduced');
    const coarse = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) {
        return;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);

    // Camera position and aim for each formation. `cloud` is the original home-page view:
    // looking down into the cluster from above, sinking as the page scrolls.
    // `shift` slides the whole picture to the right (as a fraction of the window width) on
    // wide screens, so a shape sits beside the left-aligned text instead of behind it.
    // `art` faces a picture head-on; its shift comes from the picture's own layout.
    const ART_DIST = window.ArtStage ? window.ArtStage.DIST : 520;
    const POSES = {
        cloud: { pos: [0, 300, 45], look: [0, 0, 0] },
        galaxy: { pos: [0, 235, 400], look: [0, -30, 0], shift: 0.13 },
        wall: { pos: [0, 36, 380], look: [0, -30, -200] },
        ring: { pos: [0, 150, 540], look: [0, 10, 0], shift: 0.1 },
        crescent: { pos: [40, 0, 560], look: [40, 0, 0], shift: 0.15 },
        helix: { pos: [0, 30, 520], look: [0, 0, 0], shift: 0.2 },
        art: { pos: [0, 0, ART_DIST], look: [0, 0, 0] }
    };
    let shift = 0;
    const centred = !!document.querySelector('.status'); // 404 and thank-you pages keep the shape in the middle

    const startForm = document.body.dataset.form;
    let form = startForm && startForm !== 'art' && POSES[startForm] ? startForm : 'cloud';
    let artMode = 'frame';
    let pageProgress = 0;
    let sectionProgress = 0.5;
    const mouse = { x: 0, y: 0 };      // where the pointer is, -1 to 1
    const orbit = { x: 0, y: 0 };      // the same, eased: moves the camera around a picture
    const ndc = new THREE.Vector3();
    const rayDir = new THREE.Vector3();

    const camPos = new THREE.Vector3().fromArray(POSES[form].pos);
    const camLook = new THREE.Vector3().fromArray(POSES[form].look);
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    const starfield = new window.GPGPUStarfield(scene, camera, renderer);
    const bloom = window.SimpleBloomComposer ? new window.SimpleBloomComposer(renderer, scene, camera) : null;
    if (bloom && reduced) bloom.amount = 0;
    if (form !== 'cloud' && starfield.setFormation) starfield.setFormation(form);

    // Pictures as 3D scenes. Needs the composer (the picture is drawn into its final image).
    let stage = null;
    if (!reduced && bloom && window.ArtStage && starfield.setArt) {
        stage = new window.ArtStage(renderer, camera, starfield);
        stage.onError = () => {
            // A picture could not be loaded: give the page its plain images back.
            stage.hide();
            stage = null;
            root.classList.remove('has-art');
            if (form === 'art') { form = 'wall'; starfield.setFormation(form); }
        };
        root.classList.add('has-art');
    }
    root.classList.add('has-scene');

    document.addEventListener('relic:form', (e) => {
        const d = e.detail || {};
        const art = stage && d.form === 'art' && d.art && d.art.src ? d.art : null;
        let next = d.form;
        // No 3D pictures (reduced motion): a showcase step has its plain image on the page, so the
        // stars stand back as a wall; a backdrop section just keeps the open cloud.
        if (next === 'art' && !art) next = d.art && d.art.mode === 'backdrop' ? 'cloud' : 'wall';
        if (!POSES[next]) next = 'cloud';
        if (art) {
            artMode = art.mode === 'backdrop' ? 'backdrop' : 'frame';
            stage.show(art);
        } else {
            if (stage) stage.hide();
            if (starfield.setFormation) starfield.setFormation(next);
        }
        form = next;
    });
    document.addEventListener('relic:art', (e) => {
        if (stage && e.detail && e.detail.preload) e.detail.preload.forEach((p) => stage.preload(p));
    });
    document.addEventListener('relic:scroll', (e) => {
        pageProgress = e.detail.progress;
        if (typeof e.detail.section === 'number') sectionProgress = e.detail.section;
    });

    if (!reduced) {
        window.addEventListener('pointermove', (e) => {
            const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight;
            if (bloom) bloom.pointer(x, 1 - y);
            if (e.pointerType === 'touch') return; // a finger ripples the picture but does not steer the camera
            mouse.x = x * 2 - 1;
            mouse.y = 1 - y * 2;
            if (starfield.updateMouse) starfield.updateMouse(mouse.x, mouse.y);
        }, { passive: true });
        window.addEventListener('pointerdown', (e) => {
            // A click sends a ring through the picture; a finger landing (often the start of a scroll) a softer one.
            if (bloom) bloom.pressAt(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight, e.pointerType === 'touch' ? 0.55 : 1);
        }, { passive: true });
        root.addEventListener('mouseleave', () => { if (starfield.pointerLeft) starfield.pointerLeft(); });
    }

    window.addEventListener('resize', () => {
        const w = window.innerWidth, h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (bloom) bloom.resize(w, h);
        if (stage) stage.resize(w, h);
    });

    let time = 0;
    const speed = reduced ? 0.35 : 1;
    let lastNow = 0;
    let lastScrollY = window.scrollY;
    let scrollVel = 0;

    // Slow machines: when most frames take too long, the picture is drawn with fewer pixels, one
    // step at a time. If a step does not make frames faster, the slowness is not the drawing
    // (a battery saver, a 30 Hz screen), so the step is undone and the check stops.
    const quality = {
        steps: [1.5, 1.25, 1, 0.75].filter((r) => r < renderer.getPixelRatio()),
        ratio: renderer.getPixelRatio(),
        tried: 0,     // the ratio we just stepped down from, while waiting to see if it helped
        before: 0,    // average frame time before that step
        sum: 0, n: 0, slow: 0,
        wait: 120,    // frames to skip: start-up, and after each change
        off: false
    };
    function setRatio(r) {
        quality.ratio = r;
        renderer.setPixelRatio(r);
        if (bloom) bloom.resize(window.innerWidth, window.innerHeight);
    }
    function watchSpeed(ms) {
        const q = quality;
        if (q.off || ms > 250) return; // a pause (tab switch, a file loading) is not a slow frame
        if (q.wait > 0) { q.wait--; return; }
        q.sum += ms; q.n++;
        if (ms > 24) q.slow++;
        if (q.n < 120) return;
        const avg = q.sum / q.n, mostlySlow = q.slow > q.n * 0.6;
        q.sum = q.n = q.slow = 0;
        if (q.tried) {
            if (avg > q.before * 0.88) { setRatio(q.tried); q.off = true; return; } // no faster: put it back
            q.tried = 0;
        }
        if (mostlySlow && q.steps.length) {
            q.before = avg;
            q.tried = q.ratio;
            setRatio(q.steps.shift());
            q.wait = 30;
        }
    }

    function frame(now) {
        requestAnimationFrame(frame);
        if (document.hidden) { lastNow = 0; return; }
        if (lastNow) watchSpeed(now - lastNow);
        const dt = lastNow ? Math.min(0.05, Math.max(0.004, (now - lastNow) / 1000)) : 0.016;
        lastNow = now;
        tick(dt);
    }

    function tick(dt) {
        time += 0.016 * speed;

        const pose = POSES[form];
        targetPos.fromArray(pose.pos);
        targetLook.fromArray(pose.look);
        let follow = 0.028;

        orbit.x += (mouse.x - orbit.x) * 0.06;
        orbit.y += (mouse.y - orbit.y) * 0.06;

        if (form === 'cloud') {
            // Original scroll move: from high above the cluster down to its side.
            targetPos.y = 300 - 250 * Math.min(1, pageProgress * 1.15);
            targetPos.x += mouse.x * 16;
            targetPos.y += mouse.y * 9;
        } else if (form === 'art') {
            // Around a picture: a slow sway of its own, the pointer orbits it, and scrolling
            // through its section moves in and tilts past it. This is what shows the relief.
            const back = artMode === 'backdrop';
            const sway = Math.sin(time * 0.33) * (coarse ? 0.13 : 0.05);
            const side = sway + orbit.x * (back ? 0.09 : 0.19);
            const p = sectionProgress;
            const dist = ART_DIST * (back ? 1.03 - 0.07 * p : 1.08 - 0.11 * p); // never so close that the picture runs under the status line
            targetPos.set(Math.sin(side) * dist, orbit.y * (back ? 28 : 58) + (0.5 - p) * (back ? 50 : 96), Math.cos(side) * dist);
            follow = 0.05;
        } else {
            // Slow orbit so a held shape never sits still.
            const a = Math.sin(time * 0.07) * 0.16;
            const x = targetPos.x, z = targetPos.z;
            targetPos.x = x * Math.cos(a) + z * Math.sin(a);
            targetPos.z = z * Math.cos(a) - x * Math.sin(a);
            targetPos.x += mouse.x * 16;
            targetPos.y += mouse.y * 9;
        }

        if (form !== 'art') {
            // The original slow drift of the aim point.
            const reach = camPos.length() * 0.013;
            targetLook.x += (Math.sin(time * 0.08 + 37.5) + Math.sin(time * 0.05 + 129.7) * 0.5) * reach;
            targetLook.y += (Math.cos(time * 0.06 + 83.2) + Math.cos(time * 0.04 + 129.7) * 0.5) * reach;
        }

        camPos.lerp(targetPos, follow);
        camLook.lerp(targetLook, follow);
        camera.position.copy(camPos);
        camera.lookAt(camLook);

        // Sideways lens shift (no perspective change). Off on tall, narrow screens.
        const w = window.innerWidth, h = window.innerHeight;
        let wanted = 0;
        if (form === 'art') wanted = stage ? stage.shift : 0;
        else if (!centred && w / h >= 1.3) wanted = pose.shift || 0;
        shift += (wanted - shift) * (form === 'art' ? 0.05 : 0.028);
        if (Math.abs(shift) > 0.0005) camera.setViewOffset(w, h, -shift * w, 0, w, h);
        else if (camera.view && camera.view.enabled) camera.clearViewOffset();

        // The line of sight through the pointer: stars swerve away from it.
        if (starfield.setPointerRay) {
            camera.updateMatrixWorld();
            ndc.set(mouse.x, mouse.y, 0.5).unproject(camera);
            rayDir.copy(ndc).sub(camera.position).normalize();
            starfield.setPointerRay(camera.position, rayDir);
        }

        // How fast the page is scrolling, in window heights per frame, eased: -1 to 1.
        const sy = window.scrollY;
        const v = Math.max(-1, Math.min(1, ((sy - lastScrollY) / Math.max(1, h)) * 9));
        lastScrollY = sy;
        scrollVel += (v - scrollVel) * 0.16;
        if (Math.abs(scrollVel) < 0.0005) scrollVel = 0;

        starfield.update(time);
        if (stage) {
            // Scrolling into a picture's section brings the picture in with it: fully there by the
            // time the section is nearly centred, from either direction. Standing still, it takes
            // its own time (stars first, then the burn).
            const into = Math.min(sectionProgress, 1 - sectionProgress);
            const k = Math.max(0, Math.min(1, (into - 0.1) / 0.35));
            stage.update(dt, k * k * (3 - 2 * k));
        }
        if (bloom) {
            bloom.scrollVel = scrollVel;
            bloom.render(stage ? (target) => stage.render(target, bloom.trailA.texture) : null);
        } else {
            renderer.render(scene, camera);
        }
    }
    requestAnimationFrame(frame);

    // For debugging in the console: RelicScene.setFormation('ring')
    window.RelicScene = {
        forms: Object.keys(POSES),
        starfield,
        camera,
        bloom,
        quality,
        get stage() { return stage; },
        step(n) { for (let i = 0; i < (n || 1); i++) tick(0.016); }, // advance n frames at once
        setFormation(name) { document.dispatchEvent(new CustomEvent('relic:form', { detail: { form: name } })); }
    };
})();
