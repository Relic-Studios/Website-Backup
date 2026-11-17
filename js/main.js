/* Relic Studios — the live starfield behind every page.
   Needs three.js r128, GPUComputationRenderer, GPGPUStarfield and SimpleBloomComposer
   (loaded before this file). If any of them is missing, or WebGL is unavailable,
   the page simply keeps its black background.

   The stars drift as one cloud on the home page and gather into shapes as the reader
   moves through sections: js/site.js sends a `relic:form` event with the shape name,
   and each shape has its own camera position below. */
(function () {
    'use strict';

    const container = document.getElementById('canvas-container');
    if (!container || !window.THREE || !window.GPGPUStarfield) return;

    if (/[?&]scene=off/.test(location.search)) return; // debugging aid: page without the 3D layer

    const reduced = document.documentElement.classList.contains('motion-reduced');
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
    const POSES = {
        cloud: { pos: [0, 300, 45], look: [0, 0, 0] },
        galaxy: { pos: [0, 235, 400], look: [0, -30, 0], shift: 0.13 },
        wall: { pos: [0, 36, 380], look: [0, -30, -200] },
        ring: { pos: [0, 150, 540], look: [0, 10, 0], shift: 0.1 },
        crescent: { pos: [40, 0, 560], look: [40, 0, 0], shift: 0.15 },
        helix: { pos: [0, 30, 520], look: [0, 0, 0], shift: 0.2 }
    };
    let shift = 0;
    const centred = !!document.querySelector('.status'); // 404 and thank-you pages keep the shape in the middle

    let form = (document.body.dataset.form && POSES[document.body.dataset.form]) ? document.body.dataset.form : 'cloud';
    let pageProgress = 0;
    const mouse = { x: 0, y: 0 };

    const camPos = new THREE.Vector3().fromArray(POSES[form].pos);
    const camLook = new THREE.Vector3().fromArray(POSES[form].look);
    const targetPos = new THREE.Vector3();
    const targetLook = new THREE.Vector3();
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    const starfield = new window.GPGPUStarfield(scene, camera, renderer);
    const bloom = window.SimpleBloomComposer ? new window.SimpleBloomComposer(renderer, scene, camera) : null;
    if (form !== 'cloud' && starfield.setFormation) starfield.setFormation(form);

    document.addEventListener('relic:form', (e) => {
        const next = e.detail && POSES[e.detail.form] ? e.detail.form : 'cloud';
        if (next === form) return;
        form = next;
        if (starfield.setFormation) starfield.setFormation(form);
    });
    document.addEventListener('relic:scroll', (e) => { pageProgress = e.detail.progress; });

    if (!coarse && !reduced) {
        document.addEventListener('mousemove', (e) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            if (starfield.updateMouse) starfield.updateMouse(mouse.x, mouse.y);
        }, { passive: true });
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (bloom) bloom.resize(window.innerWidth, window.innerHeight);
    });

    let time = 0;
    const speed = reduced ? 0.35 : 1;

    function frame() {
        requestAnimationFrame(frame);
        if (document.hidden) return;
        tick();
    }

    function tick() {
        time += 0.016 * speed;

        const pose = POSES[form];
        targetPos.fromArray(pose.pos);
        targetLook.fromArray(pose.look);

        if (form === 'cloud') {
            // Original scroll move: from high above the cluster down to its side.
            targetPos.y = 300 - 250 * Math.min(1, pageProgress * 1.15);
        } else {
            // Slow orbit so a held shape never sits still.
            const a = Math.sin(time * 0.07) * 0.16;
            const x = targetPos.x, z = targetPos.z;
            targetPos.x = x * Math.cos(a) + z * Math.sin(a);
            targetPos.z = z * Math.cos(a) - x * Math.sin(a);
        }

        // Pointer parallax and the original slow drift of the aim point.
        targetPos.x += mouse.x * 16;
        targetPos.y += mouse.y * 9;
        const reach = camPos.length() * 0.013;
        targetLook.x += (Math.sin(time * 0.08 + 37.5) + Math.sin(time * 0.05 + 129.7) * 0.5) * reach;
        targetLook.y += (Math.cos(time * 0.06 + 83.2) + Math.cos(time * 0.04 + 129.7) * 0.5) * reach;

        camPos.lerp(targetPos, 0.028);
        camLook.lerp(targetLook, 0.028);
        camera.position.copy(camPos);
        camera.lookAt(camLook);

        // Sideways lens shift (no perspective change). Off on tall, narrow screens.
        const w = window.innerWidth, h = window.innerHeight;
        const wanted = !centred && w / h >= 1.3 ? (pose.shift || 0) : 0;
        shift += (wanted - shift) * 0.028;
        if (Math.abs(shift) > 0.0005) camera.setViewOffset(w, h, -shift * w, 0, w, h);
        else if (camera.view && camera.view.enabled) camera.clearViewOffset();

        starfield.update(time);
        if (bloom) bloom.render(0); else renderer.render(scene, camera);
    }
    frame();

    // For debugging in the console: RelicScene.setFormation('ring')
    window.RelicScene = {
        forms: Object.keys(POSES),
        starfield,
        camera,
        step(n) { for (let i = 0; i < (n || 1); i++) tick(); }, // advance n frames at once
        setFormation(name) { document.dispatchEvent(new CustomEvent('relic:form', { detail: { form: name } })); }
    };
})();
