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
   - A section can stand in a place built in 3D instead (form "venue"): the truss cathedral of
     js/venue.js, the closing scene of the home page. It is fixed to its section: it rises
     into the window with it while its pieces fly in, its LED wall stands right above the
     section's words, and it leaves with them. Where it cannot be shown, the section's picture is.
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2)); // a phone's 3x screen gains little past 1.5
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
    // `venue` stands at the back of the truss cathedral (js/venue.js), looking down the nave.
    // VENUE_AT is where the foot of its LED wall stands: the stars' cloud is centred on the
    // world's origin, so this puts the middle of the nave there and the stars drift through it.
    const ART_DIST = window.ArtStage ? window.ArtStage.DIST : 520;
    const VENUE_AT = [0, -205, -500];
    const POSES = {
        cloud: { pos: [0, 300, 45], look: [0, 0, 0] },
        galaxy: { pos: [0, 235, 400], look: [0, -30, 0], shift: 0.13 },
        wall: { pos: [0, 36, 380], look: [0, -30, -200] },
        ring: { pos: [0, 150, 540], look: [0, 10, 0], shift: 0.1 },
        crescent: { pos: [40, 0, 560], look: [40, 0, 0], shift: 0.15 },
        helix: { pos: [0, 30, 520], look: [0, 0, 0], shift: 0.2 },
        art: { pos: [0, 0, ART_DIST], look: [0, 0, 0] },
        venue: { pos: [VENUE_AT[0], VENUE_AT[1] + 90, VENUE_AT[2] + 893], look: [VENUE_AT[0], VENUE_AT[1] + 98, VENUE_AT[2]] }
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

    // Phones and tablets get far fewer stars: on a computer the full 20000
    const starfield = new window.GPGPUStarfield(scene, camera, renderer, { count: coarse ? 6000 : 20000 });
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

    // The truss cathedral. The page names the model on the section that stands in it
    // (data-venue, with the pictures for its LED wall in data-venue-pics); it is fetched shortly
    // before that section arrives. Until it is there, and if it cannot be loaded, the section
    // shows its picture instead (or a star formation, if it names none).
    let venue = null;
    let venueAsked = false; // the current section wants the place
    let lift = 0;           // px the view is moved up (a lens shift) to keep the place on its section
    let liftWanted = 0;
    let held = 0;           // 0 to 1: how firmly the view is held to that section
    let lastAsk = null;     // what the page last asked for (the detail of its relic:form event)
    let venueNear = false;  // the place's section is in the window: the place holds the view
    const venueEl = document.querySelector('[data-venue]');
    const venueWords = venueEl && venueEl.querySelector('.wrap'); // the words that stand in front of it
    const venueBar = document.getElementById('main-nav');
    if (!reduced && bloom && window.RelicVenue && venueEl) {
        venue = new window.RelicVenue(renderer, camera);
        venue.place(VENUE_AT[0], VENUE_AT[1], VENUE_AT[2]);
        scene.add(venue.mask);
        root.classList.add('has-venue');
        const fetchVenue = () => {
            const pics = (venueEl.dataset.venuePics || '').split('|').filter(Boolean);
            venue.load(venueEl.dataset.venue, pics).then(() => {
                // the stars' part in it: about half of them settle along the truss
                if (starfield.addFormation) starfield.addFormation('nave', venue.starPlaces(), { stiff: 0.02, damp: 0.9, mixSpeed: 0.02 });
            }).catch(() => {
                scene.remove(venue.mask);
                venue = null;
                root.classList.remove('has-venue');
                // the section that wanted it gets its picture after all
                if (venueAsked && lastAsk) document.dispatchEvent(new CustomEvent('relic:form', { detail: lastAsk }));
            });
        };
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                if (entries.some((en) => en.isIntersecting)) { io.disconnect(); fetchVenue(); }
            }, { rootMargin: '250% 0px 250% 0px' });
            io.observe(venueEl);
        } else {
            fetchVenue();
        }
    }

    document.addEventListener('relic:form', (e) => {
        lastAsk = e.detail || {};
        // while the 3D place holds the view, what another section asks for waits until it has left
        if (venueNear && lastAsk.form !== 'venue') return;
        show(lastAsk);
    });
    function show(d) {
        let next = d.form;
        venueAsked = next === 'venue';
        if (venueAsked && !(venue && venue.ready)) next = d.art ? 'art' : 'ring'; // no 3D place (yet): the section's picture, or a formation
        const art = stage && next === 'art' && d.art && d.art.src ? d.art : null;
        // No 3D pictures (reduced motion): a showcase step has its plain image on the page, so the
        // stars stand back as a wall; a backdrop section just keeps the open cloud.
        if (next === 'art' && !art) next = d.art && d.art.mode === 'backdrop' ? 'cloud' : 'wall';
        if (!POSES[next]) next = 'cloud';
        const wasArt = stage && stage.active;
        if (art) {
            artMode = art.mode === 'backdrop' ? 'backdrop' : 'frame';
            // side: the visitor changed the picture by hand (1 = on to the next, -1 = back). The
            // pictures then travel sideways, against the way the visitor is going, with a streak
            // across the whole image and a gust through the stars instead of the tearing.
            const side = artMode === 'frame' && stage.active && (d.side === 1 || d.side === -1) ? d.side : 0;
            if (stage.wanted !== art.src + '|' + artMode) {
                if (side) {
                    if (bloom) bloom.swoosh = -side;
                    if (starfield.gust) starfield.gust(-side);
                } else if (bloom) bloom.glitch = Math.max(bloom.glitch, 0.75);
            }
            stage.pullTo = 0;
            stage.show(art, side);
        } else {
            if (stage) stage.hide();
            if (bloom && wasArt) bloom.glitch = Math.max(bloom.glitch, 0.5);
            if (starfield.setFormation) starfield.setFormation(next === 'venue' ? 'nave' : next); // the stars' own formation for the place (added when it loaded)
        }
        if (venue) venue.wanted = next === 'venue';
        if (starfield.setLevel) starfield.setLevel(next === 'venue' ? 0.45 : 1);
        form = next;
    }
    // A sideways drag on the showcase: the picture follows the finger (js/site.js, initShowcase).
    document.addEventListener('relic:pull', (e) => {
        if (stage && form === 'art' && artMode === 'frame') stage.pullTo = Math.max(-0.6, Math.min(0.6, Number(e.detail && e.detail.pull) || 0));
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
            if (e.pointerType === 'touch') return; // fingers are followed below
            const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight;
            if (bloom) bloom.pointer(x, 1 - y);
            mouse.x = x * 2 - 1;
            mouse.y = 1 - y * 2;
            lightWanted = 1;
            if (starfield.updateMouse) starfield.updateMouse(mouse.x, mouse.y);
        }, { passive: true });
        window.addEventListener('pointerdown', (e) => {
            // A click sends a ring through the picture.
            if (bloom && e.pointerType !== 'touch') bloom.pressAt(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight, 1);
        }, { passive: true });

        // In the 3D place, a click on the scene itself (not on a link, a button or a card) puts
        // the next picture on the LED wall.
        document.addEventListener('click', (e) => {
            if (form !== 'venue' || !venue || !venue.visible) return;
            if (e.target.closest && e.target.closest('a, button, input, select, textarea, label, summary, .card')) return;
            venue.next();
        });

        // Fingers. A browser stops sending pointer moves the moment a touch starts to scroll the
        // page, so a finger is followed through touch events, which keep coming while it scrolls.
        // A finger on the picture drags a wake through it, moves the light and turns the view;
        // when it lifts, the view eases back.
        const finger = (e, landed) => {
            const t = e.touches[0];
            if (!t) return;
            const x = t.clientX / window.innerWidth, y = t.clientY / window.innerHeight;
            if (bloom) { if (landed) bloom.pressAt(x, 1 - y, 0.55); else bloom.pointer(x, 1 - y); }
            touching = true;
            mouse.x = x * 2 - 1;
            mouse.y = 1 - y * 2;
            if (starfield.updateMouse) starfield.updateMouse(mouse.x, mouse.y);
        };
        const lifted = (e) => {
            if (e.touches.length) return;
            touching = false;
            mouse.x = mouse.y = 0;
            if (starfield.pointerLeft) starfield.pointerLeft();
        };
        window.addEventListener('touchstart', (e) => finger(e, true), { passive: true });
        window.addEventListener('touchmove', (e) => finger(e, false), { passive: true });
        window.addEventListener('touchend', lifted, { passive: true });
        window.addEventListener('touchcancel', lifted, { passive: true });
        root.addEventListener('mouseleave', () => { lightWanted = 0; if (starfield.pointerLeft) starfield.pointerLeft(); });
    }

    window.addEventListener('resize', () => {
        const w = window.innerWidth, h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (bloom) bloom.resize(w, h);
        if (stage) stage.resize(w, h);
        if (venue && venue.target) venue.resize();
    });

    // The light on a picture: the pointer where there is one, otherwise it wanders by itself.
    let lightWanted = coarse ? 1 : 0;
    const lightAt = { x: 0, y: 0 }; // -1 to 1, eased
    let touching = false;           // a finger is on the screen

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
        if (venue && venue.target) venue.resize();
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

        // The 3D place takes the view as soon as its section comes into the window, before the
        // section holds the middle of it, and keeps it until the section has left again.
        if (venue && venue.ready) {
            const top = venueEl.getBoundingClientRect().top, vh = window.innerHeight;
            const near = top < vh * (venueNear ? 0.94 : 0.88);
            if (near !== venueNear) {
                venueNear = near;
                if (near && form !== 'venue') show({ form: 'venue' });
                else if (!near && form === 'venue' && lastAsk && lastAsk.form !== 'venue') show(lastAsk);
            }
        }

        // The 3D place finished loading while its section is on screen: move in.
        if (venueAsked && form !== 'venue' && venue && venue.ready) {
            form = 'venue';
            venue.wanted = true;
            if (stage) stage.hide(); // the picture that stood in for it
            if (starfield.setFormation) starfield.setFormation('nave');
            if (starfield.setLevel) starfield.setLevel(0.45);
        }

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
        } else if (form === 'venue') {
            // The closing scene stands on the foot of its section and moves with the page (the
            // up-and-down lens shift below), so the LED wall is always right above the words:
            // it rises into the window with them, and goes up and out with them when the
            // footer comes. While it rises the camera walks in. The pointer leans it.
            const vh = window.innerHeight;
            const box = venueEl.getBoundingClientRect();
            // Measured in the scene's own frame (one window high, its foot on the section's foot):
            // where the words begin, and where the menu bar ends.
            const words = venueWords ? vh - (box.bottom - venueWords.getBoundingClientRect().top) : vh * 0.58;
            const bar = (venueBar ? venueBar.offsetHeight : 0) + 28;
            // On the wall's plane a height Y (model units) lands f * (Y - 98) / dist px above the
            // middle of the frame; the wall's top is at 436, the floor at 0.
            const f = (vh / 2) / Math.tan(camera.fov * Math.PI / 360);
            // When the footer comes up, the place stops going up with the words (it used to leave
            // only the floor behind the footer): the camera steps back so more of the nave shows,
            // and the view never rises further than keeps the top of the wall under the menu bar.
            const past = Math.max(0, vh - box.bottom);
            const e = Math.min(1, past / (vh * 0.5)), end = e * e * (3 - 2 * e);
            const fit = Math.max(703, Math.min(1000, 436 * f / Math.max(120, words - 6 - bar)));
            const dist = fit * (1 + 0.55 * end);
            const foot = vh / 2 + 98 * f / fit;                       // the floor line under the wall
            const up = Math.max(-vh * 0.1, foot - (words - 6));       // so that line meets the words
            const top = vh / 2 - (436 - 98) * f / dist;               // the top of the wall, before the shift
            liftWanted = Math.max(-vh, Math.min(vh * 1.5, vh - box.bottom + up, top - bar - 10));
            const k = Math.max(0, Math.min(1, 1 + (vh - box.bottom) / (vh * 0.6)));
            const back = 1 - k * k * (3 - 2 * k);
            targetPos.set(
                VENUE_AT[0] + orbit.x * 60 + Math.sin(time * 0.19) * 9,
                VENUE_AT[1] + 60 + 30 * back + orbit.y * 22,
                VENUE_AT[2] + dist + 190 * back);
            targetLook.set(VENUE_AT[0] + orbit.x * 14, VENUE_AT[1] + 98, VENUE_AT[2]);
            follow = 0.045;
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

        if (venue) {
            venue.update(dt);
            // While the place is up the view starts a little further from the eye: the far end of
            // the nave then keeps its surfaces apart instead of flickering through each other.
            const near = venue.visible ? 4 : 0.1;
            if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
        }

        // Lens shift (no perspective change). Sideways: off on tall, narrow screens. Up and
        // down: the 3D place keeps to its section; the hold eases in and out with the place.
        const w = window.innerWidth, h = window.innerHeight;
        let wanted = 0;
        if (form === 'art') wanted = stage ? stage.shift : 0;
        else if (!centred && w / h >= 1.3) wanted = pose.shift || 0;
        shift += (wanted - shift) * (form === 'art' ? 0.05 : 0.028);
        held += ((form === 'venue' ? 1 : 0) - held) * 0.07;
        if (held < 0.001) held = 0;
        lift = liftWanted * held;
        if (Math.abs(shift) > 0.0005 || Math.abs(lift) > 0.5) camera.setViewOffset(w, h, -shift * w, lift, w, h);
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
            if (Math.abs(scrollVel) > 0.004) stage.dir = scrollVel > 0 ? 1 : -1;
            const wander = coarse && !touching;
            const lx = wander ? Math.cos(time * 0.5) * 0.62 : mouse.x, ly = wander ? Math.sin(time * 0.37) * 0.5 : mouse.y;
            lightAt.x += (lx - lightAt.x) * 0.2;
            lightAt.y += (ly - lightAt.y) * 0.2;
            stage.light.set(lightAt.x * 0.5 + 0.5, lightAt.y * 0.5 + 0.5);
            stage.lightOn += (lightWanted - stage.lightOn) * 0.07;
            // Scrolling into a picture's section brings the picture in with it: fully there by the
            // time the section is nearly centred, from either direction. Standing still, it takes
            // its own time (stars first, then the burn).
            const into = Math.min(sectionProgress, 1 - sectionProgress);
            const k = Math.max(0, Math.min(1, (into - 0.1) / 0.35));
            stage.update(dt, k * k * (3 - 2 * k));
            if (starfield.setOffset) starfield.setOffset(stage.offsetX);
        }
        if (bloom) {
            bloom.scrollVel = scrollVel;
            const place = venue && venue.visible ? venue : null;
            if (place) place.render();
            bloom.render(stage || place ? (target) => {
                if (place) place.draw(target);
                if (stage) stage.render(target, bloom.trailA.texture);
            } : null);
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
        get venue() { return venue; },
        step(n) { for (let i = 0; i < (n || 1); i++) tick(0.016); }, // advance n frames at once
        setFormation(name) { document.dispatchEvent(new CustomEvent('relic:form', { detail: { form: name } })); }
    };
})();
