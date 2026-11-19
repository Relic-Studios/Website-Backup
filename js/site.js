/* Relic Studios — interface behavior for every page.
   No dependencies. Each feature checks for its own markup and does nothing if it is absent.
   The 3D background lives in main.js; this file talks to it only through events:
   `relic:form` (which star formation or picture to show), `relic:art` (pictures to fetch
   ahead of time) and `relic:scroll` (how far the page and the current section have scrolled). */
(function () {
    'use strict';

    const doc = document;
    const root = doc.documentElement;
    const $ = (s, el) => (el || doc).querySelector(s);
    const $$ = (s, el) => Array.from((el || doc).querySelectorAll(s));
    const reduced = root.classList.contains('motion-reduced');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    /* ---------- text splitting (word masks) ---------- */
    function splitWords(el, wrapInner) {
        let n = 0;
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = doc.createDocumentFragment();
                    child.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
                        const w = doc.createElement('span');
                        w.className = 'w';
                        if (wrapInner) {
                            const wi = doc.createElement('span');
                            wi.className = 'wi';
                            wi.style.setProperty('--i', n);
                            wi.textContent = part;
                            w.appendChild(wi);
                        } else {
                            w.textContent = part;
                        }
                        n++;
                        frag.appendChild(w);
                    });
                    node.replaceChild(frag, child);
                } else if (child.nodeType === 1) {
                    if (child.hasAttribute('data-keep')) {
                        // Styled words (serif / mono accents) move as one unit.
                        const w = doc.createElement('span');
                        w.className = child.classList.contains('goth') ? 'w w--goth' : 'w';
                        node.replaceChild(w, child);
                        if (wrapInner) {
                            const wi = doc.createElement('span');
                            wi.className = 'wi';
                            wi.style.setProperty('--i', n);
                            wi.appendChild(child);
                            w.appendChild(wi);
                        } else {
                            w.appendChild(child);
                        }
                        n++;
                    } else {
                        walk(child);
                    }
                }
            });
        };
        walk(el);
        return n;
    }

    /* ---------- reveal on scroll ---------- */
    function initReveal() {
        $$('[data-split]').forEach((el) => splitWords(el, true));
        $$('[data-stagger]').forEach((group) => {
            $$('[data-reveal]', group).forEach((el, i) => el.style.setProperty('--i', i % 8));
        });
        const targets = $$('[data-reveal], [data-split], .timeline__item');
        if (!('IntersectionObserver' in window)) {
            targets.forEach((el) => el.classList.add('is-in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        targets.forEach((el) => io.observe(el));
    }

    /* ---------- scroll-lit statement ---------- */
    const litBlocks = [];
    function initLitText() {
        $$('[data-words]').forEach((el) => {
            splitWords(el, false);
            litBlocks.push({ el, words: $$('.w', el) });
        });
    }
    function updateLitText() {
        const vh = window.innerHeight;
        litBlocks.forEach(({ el, words }) => {
            const r = el.getBoundingClientRect();
            const p = clamp((vh * 0.86 - r.top) / (r.height + vh * 0.42), 0, 1);
            const lit = Math.round(p * words.length);
            words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
        });
    }

    /* ---------- navigation, progress, HUD ---------- */
    const nav = $('#main-nav');
    const pctEl = $('[data-hud-pct]');
    const isHome = doc.body.classList.contains('page-home');
    let ticking = false;

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            const y = window.scrollY;
            const max = Math.max(1, root.scrollHeight - window.innerHeight);
            const p = clamp(y / max, 0, 1);
            root.style.setProperty('--p', p.toFixed(4));
            if (nav) nav.classList.toggle('is-scrolled', y > 24);
            if (pctEl) pctEl.textContent = String(Math.round(p * 100)).padStart(3, '0');
            updateSection();
            // How far the middle of the window has travelled through the current section (0 to 1).
            let section = 0.5;
            if (currentSection) {
                const r = currentSection.getBoundingClientRect();
                section = clamp((window.innerHeight * 0.5 - r.top) / Math.max(1, r.height), 0, 1);
            }
            let d;
            if (artOn === 'frame') d = 0.02;          // a picture is on stage: nothing dims it
            else if (artOn === 'backdrop') d = 0.42;  // a picture fills the window behind text: keep the text readable
            else if (root.classList.contains('has-venue') && venueShown()) d = 0.04; // the 3D place is the picture (also once the footer has come up under it)
            else if (isHome) d = 0.10 + 0.34 * clamp(y / (window.innerHeight * 0.85), 0, 1); // the starfield is the hero; it steps back once reading starts
            else d = 0.26 + 0.2 * clamp(y / (window.innerHeight * 0.6), 0, 1);               // inner pages: the formation shows through the page title, then steps back
            root.style.setProperty('--dim', d.toFixed(3));
            updateLitText();
            doc.dispatchEvent(new CustomEvent('relic:scroll', { detail: { progress: p, y, section } }));
        });
    }

    // The closing scene's section still fills the top of the window (at the very end of the page the
    // footer is the current section, and the old dimming put a dark layer over the LED wall).
    function venueShown() {
        const v = document.querySelector('[data-venue]');
        if (!v) return false;
        const r = v.getBoundingClientRect();
        return r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.3;
    }

    function initMenu() {
        const toggle = $('.nav__toggle');
        const menu = $('#menu');
        if (!toggle || !menu) return;
        const label = $('.nav__toggle-l', toggle);
        const set = (open) => {
            if (open) menu.hidden = false;
            // Force a frame so the opening transition runs.
            void menu.offsetWidth;
            doc.body.classList.toggle('menu-open', open);
            toggle.setAttribute('aria-expanded', String(open));
            if (label) label.textContent = open ? 'Close' : 'Menu';
            doc.body.style.overflow = open ? 'hidden' : '';
            if (!open) setTimeout(() => { if (!doc.body.classList.contains('menu-open')) menu.hidden = true; }, 380);
        };
        toggle.setAttribute('role', 'button');
        toggle.addEventListener('click', (e) => { e.preventDefault(); set(!doc.body.classList.contains('menu-open')); });
        menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
        doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && doc.body.classList.contains('menu-open')) set(false); });
        window.addEventListener('resize', () => { if (window.innerWidth > 900 && doc.body.classList.contains('menu-open')) set(false); });
    }

    /* Which section holds the middle of the viewport: sets the HUD label and what the 3D
       background shows. A section names a star formation (data-form), or a picture that the
       background turns into a 3D scene (data-form="art" with data-art; see js/artscene.js). */
    let sectionEls = [];
    let currentSection;
    let artOn = ''; // '', 'frame' or 'backdrop': how the 3D background is showing a picture right now
    const upright = () => window.innerWidth < window.innerHeight;
    const artOf = (el) => {
        const d = el.dataset;
        if (!d.art) return null;
        const mode = d.artMode === 'backdrop' ? 'backdrop' : 'frame';
        // A section can name a second, upright picture for upright windows (phones).
        if (d.artTall && upright()) return { src: d.artTall, full: d.artTallFull || '', depth: d.depthTall || '', mode };
        return { src: d.art, full: d.artFull || '', depth: d.depth || '', mode };
    };
    function initSections() {
        sectionEls = $$('[data-section], [data-form]').filter((el) => el !== doc.body);
        updateSection();

        // Fetch each picture shortly before its section arrives.
        const artEls = sectionEls.filter((el) => el.dataset.art);
        if (artEls.length && 'IntersectionObserver' in window && root.classList.contains('has-art')) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    io.unobserve(entry.target);
                    doc.dispatchEvent(new CustomEvent('relic:art', { detail: { preload: [artOf(entry.target)] } }));
                });
            }, { rootMargin: '140% 0px 140% 0px' });
            artEls.forEach((el) => io.observe(el));
        }

        // Turning a phone changes which picture a section shows.
        let wasUpright = upright();
        window.addEventListener('resize', () => {
            if (upright() === wasUpright) return;
            wasUpright = upright();
            if (currentSection && currentSection.dataset.artTall) { currentSection = null; updateSection(); }
        });
    }
    function updateSection() {
        if (!sectionEls.length) return;
        const mid = window.innerHeight * 0.5;
        let best = null;
        sectionEls.forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.top <= mid && r.bottom >= mid) best = el; // a nested section wins over its parent
        });
        if (!best || best === currentSection) return;
        currentSection = best;
        const label = $('[data-hud-section]');
        if (label && best.dataset.section) label.textContent = best.dataset.section;
        const form = best.dataset.form || doc.body.dataset.form || 'cloud';
        // A section in the 3D place (form "venue") also names a picture, shown when the place cannot be.
        const place = form === 'venue' && root.classList.contains('has-venue');
        const art = form === 'art' || form === 'venue' ? artOf(best) : null;
        artOn = !place && art && root.classList.contains('has-art') ? art.mode : '';
        root.classList.toggle('art-on', artOn === 'frame');

        doc.dispatchEvent(new CustomEvent('relic:form', { detail: { form, art } }));
    }

    /* ---------- showcase: one picture at a time ----------
       The visitor changes the picture by tapping or clicking the left or right side of it,
       swiping sideways, the arrow keys or the rail. Scrolling only moves down the page. Until
       the visitor changes a picture, the pictures change by themselves.
       The showcase is one section: its data-art attributes always name the current picture
       (copied from the hidden .showcase__step of that picture), so updateSection() needs no
       special case. A change made here is sent with `side` (1 = on to the next, -1 = back),
       which js/main.js turns into a sideways move instead of the usual burn. */
    function initShowcase() {
        const box = $('.showcase');
        if (!box) return;
        const pin = $('.showcase__pin', box);
        const figs = $$('.show', box);
        const steps = $$('.showcase__step', box);
        const dots = $$('.showcase__rail button', box);
        const n = figs.length;
        if (n < 2 || steps.length !== n) return;
        const HOLD = 6500;       // ms a picture stays before the next comes by itself
        let index = 0;
        let auto = !reduced;     // off for good once the visitor changes a picture
        let due = 0;             // when the next automatic change happens
        let since = 0;           // when the current wait began
        let swipedAt = 0;        // a swipe ends in a click on whatever is under it: ignored

        // Where the current picture is on screen, for the two buttons that cover its halves.
        const measure = () => {
            const fig = figs[index], img = $('.show__img', fig), cs = getComputedStyle(fig);
            const v = (name) => (parseFloat(cs.getPropertyValue(name)) || 0) / 100;
            const W = pin.clientWidth, H = pin.clientHeight;
            const bw = v('--bw') * W, bh = v('--bh') * H;
            const aspect = (Number(img.getAttribute('width')) / Number(img.getAttribute('height'))) || 1;
            const w = Math.min(bw, bh * aspect), h = w / aspect;
            pin.style.setProperty('--px', (v('--bx') * W + (bw - w) / 2).toFixed(1) + 'px');
            pin.style.setProperty('--py', (v('--by') * H + (bh - h) / 2).toFixed(1) + 'px');
            pin.style.setProperty('--pw', w.toFixed(1) + 'px');
            pin.style.setProperty('--ph', h.toFixed(1) + 'px');
        };
        const wait = (ms) => { since = performance.now(); due = since + ms; };
        const fetchAhead = (i) => {
            if (!root.classList.contains('has-art')) return;
            const piece = artOf(steps[((i % n) + n) % n]);
            if (piece) doc.dispatchEvent(new CustomEvent('relic:art', { detail: { preload: [piece] } }));
        };
        const pull = (f) => {
            pin.style.setProperty('--pull', f.toFixed(3));
            doc.dispatchEvent(new CustomEvent('relic:pull', { detail: { pull: f } }));
        };

        const go = (to, side, byHand) => {
            to = ((to % n) + n) % n;
            if (byHand && auto) { auto = false; box.classList.add('is-used'); box.style.setProperty('--t', '1'); }
            if (to === index) return;
            const from = figs[index], next = figs[to];
            pin.style.setProperty('--dir', side);
            next.classList.add('is-coming');
            void next.offsetWidth; // the new caption starts on the far side, then comes in
            from.classList.remove('is-active');
            next.classList.remove('is-coming');
            next.classList.add('is-active');
            dots.forEach((d, i) => {
                d.classList.toggle('is-active', i === to);
                if (i === to) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
            });
            index = to;
            ['art', 'artFull', 'depth'].forEach((k) => {
                if (steps[to].dataset[k]) box.dataset[k] = steps[to].dataset[k]; else delete box.dataset[k];
            });
            measure();
            wait(HOLD);
            if (auto) box.style.setProperty('--t', '0');
            if (currentSection === box && root.classList.contains('has-art')) {
                doc.dispatchEvent(new CustomEvent('relic:form', { detail: { form: 'art', art: artOf(box), side } }));
            }
            fetchAhead(to + side);
        };

        $('.showcase__go--prev', box).addEventListener('click', () => { if (performance.now() - swipedAt > 400) go(index - 1, -1, true); });
        $('.showcase__go--next', box).addEventListener('click', () => { if (performance.now() - swipedAt > 400) go(index + 1, 1, true); });
        dots.forEach((d, i) => d.addEventListener('click', () => go(i, i > index ? 1 : -1, true)));

        doc.addEventListener('keydown', (e) => {
            if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable], dialog')) return;
            if (currentSection !== box && !box.contains(doc.activeElement)) return;
            const side = e.key === 'ArrowRight' ? 1 : -1;
            go(index + side, side, true);
        });

        // Swipe: the picture follows the finger (or a mouse drag); let go far enough or fast
        // enough and it carries on to the next one, otherwise it springs back.
        let down = null;
        pin.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, swiping: false };
        });
        pin.addEventListener('pointermove', (e) => {
            if (!down || e.pointerId !== down.id) return;
            const dx = e.clientX - down.x, dy = e.clientY - down.y;
            if (!down.swiping) {
                if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
                down.swiping = true;
                try { pin.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
            }
            down.dx = dx;
            wait(HOLD);
            pull(clamp(dx / pin.clientWidth, -0.6, 0.6));
        });
        const up = (e, cancelled) => {
            if (!down || e.pointerId !== down.id) return;
            const d = down;
            down = null;
            if (!d.swiping) return;
            swipedAt = performance.now();
            const fast = Math.abs(d.dx) / Math.max(1, swipedAt - d.t) > 0.45; // px per ms
            const far = Math.abs(d.dx) > pin.clientWidth * 0.14;
            if (!cancelled && (far || (fast && Math.abs(d.dx) > 24))) go(index + (d.dx < 0 ? 1 : -1), d.dx < 0 ? 1 : -1, true);
            pull(0);
        };
        pin.addEventListener('pointerup', (e) => up(e, false));
        pin.addEventListener('pointercancel', (e) => up(e, true));
        // A visitor playing with the picture is not interrupted by the next one.
        pin.addEventListener('pointermove', () => { if (auto && due - performance.now() < 3000) due = performance.now() + 3000; }, { passive: true });

        measure();
        window.addEventListener('resize', measure);
        fetchAhead(1);

        if (!auto) { box.style.setProperty('--t', '1'); return; }
        box.style.setProperty('--t', '0');
        wait(HOLD);
        setInterval(() => {
            if (!auto) return;
            const now = performance.now();
            if (currentSection !== box || doc.hidden || down) { wait(HOLD); box.style.setProperty('--t', '0'); return; }
            if (now >= due) { go(index + 1, 1, false); return; }
            box.style.setProperty('--t', clamp((now - since) / Math.max(1, due - since), 0, 1).toFixed(3));
        }, 250);
    }

    /* Lists lean with the scroll: a small skew that follows how fast the page is moving. */
    function initScrollLean() {
        const els = $$('[data-sv]');
        if (reduced || !finePointer || !els.length) return;
        let last = window.scrollY, v = 0, shown = 0;
        const loop = () => {
            const y = window.scrollY;
            const target = clamp(((y - last) / Math.max(1, window.innerHeight)) * 7, -1, 1);
            last = y;
            v += (target - v) * 0.14;
            const out = Math.abs(v) < 0.004 ? 0 : Math.round(v * 250) / 250;
            if (out !== shown) {
                shown = out;
                els.forEach((el) => { el.style.transform = out ? `skewY(${(out * 1.8).toFixed(3)}deg)` : ''; });
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    function initTimecode() {
        const el = $('[data-timecode]');
        if (!el || reduced) return;
        const two = (n) => String(n).padStart(2, '0');
        const start = performance.now();
        const tick = () => {
            if (el.offsetParent !== null) {
                const t = (performance.now() - start) / 1000;
                el.textContent = `${two(Math.floor(t / 3600))}:${two(Math.floor(t / 60) % 60)}:${two(Math.floor(t) % 60)}:${two(Math.floor((t % 1) * 30))}`;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    /* ---------- pointer light ---------- */
    function initPointer() {
        if (!finePointer) return;
        doc.addEventListener('pointermove', (e) => {
            const card = e.target.closest && e.target.closest('.card');
            if (card) {
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${e.clientX - r.left}px`);
                card.style.setProperty('--my', `${e.clientY - r.top}px`);
            }
        }, { passive: true });

        const aura = $('.aura');
        if (!aura || reduced) return;
        let tx = window.innerWidth / 2, ty = window.innerHeight / 2, x = tx, y = ty, running = false;
        const step = () => {
            x += (tx - x) * 0.12;
            y += (ty - y) * 0.12;
            aura.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
            if (Math.abs(tx - x) + Math.abs(ty - y) > 0.5) requestAnimationFrame(step); else running = false;
        };
        doc.addEventListener('pointermove', (e) => {
            tx = e.clientX; ty = e.clientY;
            aura.classList.add('is-on');
            if (!running) { running = true; requestAnimationFrame(step); }
        }, { passive: true });
        doc.addEventListener('pointerleave', () => aura.classList.remove('is-on'));
    }

    /* ---------- gallery: filters and lightbox ---------- */
    function initGallery() {
        const grid = $('#gallery-grid');
        if (!grid) return;
        const cards = $$('.g-card', grid);
        const filters = $$('.g-filter');
        const box = $('#lightbox');
        let filter = (filters.find((f) => f.classList.contains('is-active')) || {}).dataset;
        filter = filter ? filter.filter : 'all';
        const visible = () => cards.filter((c) => !c.hidden);

        const applyFilter = (name) => {
            filter = name;
            let i = 0;
            cards.forEach((c) => {
                const show = name === 'all' || c.dataset.type === name;
                c.hidden = !show;
                c.classList.remove('is-enter');
                if (show) {
                    c.style.setProperty('--i', i++);
                    void c.offsetWidth;
                    c.classList.add('is-enter');
                }
            });
            filters.forEach((f) => {
                const on = f.dataset.filter === name;
                f.classList.toggle('is-active', on);
                f.setAttribute('aria-pressed', String(on));
            });
        };
        filters.forEach((f) => f.addEventListener('click', () => applyFilter(f.dataset.filter)));

        if (!box || typeof box.showModal !== 'function') return;
        const mediaEl = $('[data-lb-media]', box);
        const titleEl = $('[data-lb-title]', box);
        const capEl = $('[data-lb-caption]', box);
        const countEl = $('[data-lb-count]', box);
        let index = 0;
        let opener = null;

        const show = (i) => {
            const list = visible();
            if (!list.length) return;
            index = (i + list.length) % list.length;
            const card = list[index];
            mediaEl.textContent = '';
            if (card.dataset.media === 'video') {
                const v = doc.createElement('video');
                v.src = card.href;
                v.controls = true; v.autoplay = true; v.loop = true; v.playsInline = true; v.preload = 'metadata';
                if (card.dataset.poster) v.poster = card.dataset.poster;
                mediaEl.appendChild(v);
            } else {
                const img = doc.createElement('img');
                img.src = card.href;
                img.alt = card.dataset.title || '';
                img.decoding = 'async';
                mediaEl.appendChild(img);
            }
            titleEl.textContent = card.dataset.title || '';
            capEl.textContent = card.dataset.caption || '';
            countEl.textContent = `${String(index + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
        };
        const close = () => { if (box.open) box.close(); };

        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.g-card');
            if (!card || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            opener = card;
            show(visible().indexOf(card));
            box.showModal();
        });
        box.addEventListener('close', () => {
            mediaEl.textContent = '';
            if (opener) opener.focus({ preventScroll: true });
        });
        box.addEventListener('click', (e) => {
            if (e.target === box || e.target.classList.contains('lightbox__stage') || e.target.classList.contains('lightbox__media')) close();
        });
        $('[data-lb-close]', box).addEventListener('click', close);
        $('[data-lb-prev]', box).addEventListener('click', () => show(index - 1));
        $('[data-lb-next]', box).addEventListener('click', () => show(index + 1));
        box.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') show(index - 1);
            if (e.key === 'ArrowRight') show(index + 1);
        });
        let touchX = null;
        box.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
        box.addEventListener('touchend', (e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
            touchX = null;
        }, { passive: true });
    }

    /* ---------- achievement details ---------- */
    function initAchievements() {
        const modal = $('#ach-modal');
        const cards = $$('[data-ach]');
        if (!modal || !cards.length || typeof modal.showModal !== 'function') return;
        const titleEl = $('[data-sheet-title]', modal);
        const metaEl = $('[data-sheet-meta]', modal);
        const mediaEl = $('[data-sheet-media]', modal);
        const textEl = $('[data-sheet-text]', modal);
        const body = $('.sheet__body', modal);
        let opener = null;

        const open = (card) => {
            opener = card;
            titleEl.textContent = $('.card__t', card).textContent;
            const meta = $('.card__n span', card);
            metaEl.textContent = meta ? meta.textContent : '';
            textEl.innerHTML = $('[data-ach-detail]', card).innerHTML;
            mediaEl.textContent = '';
            const d = card.dataset;
            if (d.instagram) {
                const f = doc.createElement('iframe');
                f.className = 'ig'; f.src = d.instagram; f.title = 'Instagram post'; f.loading = 'lazy';
                f.setAttribute('scrolling', 'no');
                mediaEl.appendChild(f);
            } else if (d.photo) {
                const img = doc.createElement('img');
                img.src = d.photo; img.alt = d.photoAlt || '';
                mediaEl.appendChild(img);
            }
            if (d.youtube) {
                const f = doc.createElement('iframe');
                f.className = 'ytf'; f.src = `https://www.youtube.com/embed/${d.youtube}`; f.title = 'YouTube video player';
                f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                f.allowFullscreen = true;
                mediaEl.appendChild(f);
            } else if (d.video) {
                const v = doc.createElement('video');
                v.controls = true; v.preload = 'metadata'; v.playsInline = true; v.src = d.video;
                if (d.poster) v.poster = d.poster;
                mediaEl.appendChild(v);
            }
            body.classList.toggle('is-textonly', !mediaEl.children.length);
            modal.showModal();
            modal.scrollTop = 0;
        };
        cards.forEach((card) => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('a')) return; // ordinary links stay ordinary
                open(card);
            });
        });
        $('[data-sheet-close]', modal).addEventListener('click', () => modal.close());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
        modal.addEventListener('close', () => {
            mediaEl.textContent = ''; // stops any playing media
            if (opener) { const b = $('[data-ach-open]', opener); if (b) b.focus({ preventScroll: true }); }
        });
    }

    /* ---------- tabs ---------- */
    function initTabs() {
        $$('[data-tabs]').forEach((group) => {
            const tabs = $$('[role="tab"]', group);
            const panels = tabs.map((t) => doc.getElementById(t.getAttribute('aria-controls')));
            const select = (i, focus) => {
                tabs.forEach((t, n) => {
                    const on = n === i;
                    t.classList.toggle('is-active', on);
                    t.setAttribute('aria-selected', String(on));
                    t.tabIndex = on ? 0 : -1;
                    if (panels[n]) panels[n].classList.toggle('is-active', on);
                });
                if (focus) tabs[i].focus();
            };
            tabs.forEach((t, i) => {
                t.addEventListener('click', () => select(i));
                t.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowRight') select((i + 1) % tabs.length, true);
                    if (e.key === 'ArrowLeft') select((i - 1 + tabs.length) % tabs.length, true);
                });
            });
            select(Math.max(0, tabs.findIndex((t) => t.classList.contains('is-active'))));
        });

        // Five clicks on a team photo that has an alternate image swaps it (kept from the old site).
        $$('.team__photo[data-alt-src]').forEach((box) => {
            const img = $('img', box);
            const original = img.src;
            let clicks = 0;
            let flipped = false;
            box.addEventListener('click', () => {
                if (++clicks < 5) return;
                clicks = 0;
                flipped = !flipped;
                box.classList.add('is-flip');
                setTimeout(() => { img.src = flipped ? box.dataset.altSrc : original; box.classList.remove('is-flip'); }, 380);
            });
        });
    }

    /* ---------- YouTube: load the player only when asked ---------- */
    function initVideoFacades() {
        doc.addEventListener('click', (e) => {
            const a = e.target.closest && e.target.closest('a.yt[data-yt]');
            if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            const f = doc.createElement('iframe');
            f.src = `https://www.youtube-nocookie.com/embed/${a.dataset.yt}?autoplay=1&rel=0&modestbranding=1`;
            f.title = a.dataset.title || 'Video';
            f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            f.allowFullscreen = true;
            const box = doc.createElement('div');
            box.className = 'yt';
            box.appendChild(f);
            a.replaceWith(box);
        });
    }

    /* ---------- label scramble ---------- */
    function initScramble() {
        if (reduced || !('IntersectionObserver' in window)) return;
        const glyphs = '01<>/\\[]{}—=+*^?#_';
        const run = (el) => {
            const final = el.dataset.text;
            const start = performance.now();
            const dur = 520 + final.length * 14;
            const frame = (now) => {
                const p = clamp((now - start) / dur, 0, 1);
                const fixed = Math.floor(p * final.length);
                let out = final.slice(0, fixed);
                for (let i = fixed; i < final.length; i++) out += final[i] === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0];
                el.textContent = out;
                if (p < 1) requestAnimationFrame(frame); else el.textContent = final;
            };
            requestAnimationFrame(frame);
        };
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
        }, { threshold: 0.6 });
        $$('[data-scramble]').forEach((el) => { el.dataset.text = el.textContent; io.observe(el); });
    }

    /* ---------- motion switch (footer) ---------- */
    function initMotionToggle() {
        const btn = $('[data-motion-toggle]');
        if (!btn) return;
        btn.hidden = false;
        $('b', btn).textContent = reduced ? 'reduced' : 'full';
        btn.setAttribute('aria-label', `Motion is ${reduced ? 'reduced' : 'full'}. Switch to ${reduced ? 'full' : 'reduced'} motion.`);
        btn.addEventListener('click', () => {
            try { localStorage.setItem('relic-motion', reduced ? 'full' : 'reduced'); } catch (e) { /* private mode */ }
            location.reload();
        });
    }

    /* Arrows around the contact button (and the e-mail address) that blink in turn while the
       pointer is on it. They go on the sides that are free, and above and below. */
    function initNudge() {
        const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
        $$('.cta .btn--solid, .cta__mail a').forEach((el) => {
            let sides;
            if (el.classList.contains('btn')) {
                const left = !el.previousElementSibling, right = !el.nextElementSibling;
                sides = left && right ? ['l', 'r', 'b'] : left ? ['l', 'b', 't'] : right ? ['r', 'b', 't'] : ['t', 'b'];
            } else {
                sides = ['r', 'b'];
            }
            const wrap = doc.createElement('span');
            wrap.className = 'nudge' + (sides.length === 2 ? ' nudge--2' : '');
            el.parentNode.insertBefore(wrap, el);
            wrap.appendChild(el);
            sides.forEach((side, i) => {
                const a = doc.createElement('span');
                a.className = 'nudge__a nudge__a--' + side;
                a.style.setProperty('--i', i);
                a.setAttribute('aria-hidden', 'true');
                a.innerHTML = arrow;
                wrap.appendChild(a);
            });
        });
    }

    /* ---------- boot ---------- */
    function boot() {
        initLitText();
        initReveal();
        initMenu();
        initSections();
        initShowcase();
        initScrollLean();
        initTimecode();
        initPointer();
        initGallery();
        initAchievements();
        initTabs();
        initVideoFacades();
        initScramble();
        initMotionToggle();
        initNudge();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        onScroll();
        requestAnimationFrame(() => requestAnimationFrame(() => doc.body.classList.add('is-ready')));
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
