/**
 * Relic Studios site builder.
 *
 * Reads page bodies from _src/pages/*.html and content from _src/data.cjs,
 * wraps each page in the shared head, navigation and footer, and writes plain
 * static HTML into the repository root (which GitHub Pages serves as-is).
 * Also writes sitemap.xml.
 *
 * Usage: node tools/build.cjs   (or: npm run build)
 *
 * Page source format:
 *   <!--meta { "out": "about.html", "title": "...", "description": "...", ... } -->
 *   <!--head ...optional extra tags for <head>, e.g. JSON-LD... head-->
 *   ...body HTML...
 * Tokens: {{root}} (relative path to the site root), {{site}} (https://relicstudios.xyz),
 *         {{> partial key=value}} (see PARTIALS below).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '_src');
const SITE = 'https://relicstudios.xyz';
const data = require(path.join(SRC, 'data.cjs'));
const media = JSON.parse(fs.readFileSync(path.join(SRC, 'media.json'), 'utf8'));
const { LINKS } = data;

// Short content hash appended to local CSS/JS URLs so browsers pick up new versions.
const crypto = require('crypto');
const ver = (rel) => {
    try { return '?v=' + crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 8); } catch (e) { return ''; }
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = (p) => p.split('/').map(encodeURIComponent).join('/');
const pad = (n) => String(n).padStart(2, '0');
// Depth map for a picture, if tools/make-depth.py has made one (same file naming as the thumbnails).
const depthOf = (src) => {
    const rel = `assets/images/depth/${path.basename(src).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.webp`;
    return fs.existsSync(path.join(ROOT, rel)) ? rel : '';
};
// Attributes that tell the 3D background which picture a section shows (read by js/site.js).
// `tall` (optional) is a second, upright picture used instead when the window is taller than wide.
const artAttrs = (root, src, mode, tall) => {
    const one = (src, tag) => {
        const m = media[src];
        if (!m) throw new Error(`art: no thumbnail recorded for "${src}" (run npm run thumbs)`);
        const depth = depthOf(src);
        return `data-art${tag}="${root}${url(m.src)}" data-art${tag}-full="${root}${url(src)}"${depth ? ` data-depth${tag}="${root}${url(depth)}"` : ''}`;
    };
    return `data-form="art" ${one(src, '')}${tall ? ' ' + one(tall, '-tall') : ''}${mode ? ` data-art-mode="${mode}"` : ''}`;
};

const ICON = {
    arrow: '<svg class="i-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    right: '<svg class="i-right" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    discord: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>'
};

/* ---------- partials ---------- */

function workRows(rows, root) {
    return `<ol class="work" data-stagger data-sv>
${rows.map((w) => `    <li class="work__item" data-reveal><a class="work__row" href="${root}projects/${w.slug}.html">
        <span class="work__n">${w.n}</span>
        <span class="work__t">${esc(w.title)}</span>
        <span class="work__d">${esc(w.detail)}</span>
        <span class="work__y">${esc(w.year)}</span>
        <span class="work__a">${ICON.arrow}</span>
    </a></li>`).join('\n')}
</ol>`;
}

function ytFacade(id, title) {
    return `<a class="yt" href="https://www.youtube.com/watch?v=${id}" data-yt="${id}" data-title="${esc(title)}">
    <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">
    <span class="yt__play">${ICON.play}</span>
    <span class="yt__label">Play: ${esc(title)}</span>
</a>`;
}

function tags(list) {
    return `<ul class="tags">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
}

const PARTIALS = {
    worklist({ root }, args) {
        const rows = args.group ? data.work.filter((w) => w.group === args.group) : data.work;
        return workRows(rows, root);
    },

    ticker() {
        const items = data.work.map((w) => `<span class="ticker__item">${esc(w.title)}</span><i class="ticker__sep"></i>`).join('');
        return `<div class="ticker" aria-hidden="true"><div class="ticker__track">${items}${items}</div></div>`;
    },

    // Viewer at the top of the gallery: one picture at a time, which the 3D background turns into
    // a scene (js/artscene.js). The visitor changes the picture by tapping or clicking a side of
    // it, swiping, the arrow keys or the rail (js/site.js, initShowcase). The <img> is what shows
    // without 3D. The showcase itself is the section; each .showcase__step is a hidden holder
    // for one picture's files, and js/site.js copies the current one's attributes onto it.
    showcase({ root }) {
        const items = data.showcase.map((src) => {
            const g = data.gallery.find((x) => x.src === src);
            if (!g) throw new Error(`showcase: "${src}" is not in the gallery list`);
            return { g, m: media[src], src, cap: g.caption.replace(/ \| /g, ' · ') };
        });
        const n = items.length;
        const figures = items.map(({ g, m, cap }, i) => `        <figure class="show${m.width > m.height ? ' show--wide' : ''}${i === 0 ? ' is-active' : ''}">
            <img class="show__img" src="${root}${url(m.src)}" width="${m.width}" height="${m.height}" alt="${esc(g.title)}: ${esc(cap)}" loading="lazy" decoding="async" draggable="false">
            <figcaption class="show__cap">
                <span class="show__n">${pad(i + 1)} <i>/</i> ${pad(n)}</span>
                <strong class="show__t">${esc(g.title)}</strong>
                <span class="show__d">${esc(cap)}</span>
            </figcaption>
        </figure>`).join('\n');
        const steps = items.map(({ src }, i) => `    <div class="showcase__step" data-show="${i}" ${artAttrs(root, src).replace('data-form="art" ', '')}></div>`).join('\n');
        const rail = items.map(({ g }, i) => `<li><button type="button"${i === 0 ? ' class="is-active" aria-current="true"' : ''} aria-label="Picture ${i + 1} of ${n}: ${esc(g.title)}"></button></li>`).join('');
        return `<div class="showcase" data-section="Gallery" ${artAttrs(root, items[0].src)}>
    <div class="showcase__pin">
${figures}
        <button type="button" class="showcase__go showcase__go--prev" aria-label="Previous picture">${ICON.right}</button>
        <button type="button" class="showcase__go showcase__go--next" aria-label="Next picture">${ICON.right}</button>
        <div class="showcase__ctl">
            <ol class="showcase__rail">${rail}</ol>
            <p class="showcase__hint" aria-hidden="true"><span class="showcase__hint-t">Swipe or tap a side</span><span class="showcase__hint-m">Click a side or use the arrow keys</span></p>
        </div>
    </div>
${steps}
</div>`;
    },

    // {{> venue src=assets/images/x.jpg [tall=...] [mode=backdrop]}} inside a tag: that section
    // stands in the truss cathedral (js/venue.js), with the pictures of data.venuePics on its
    // LED wall. src, tall and mode are the same as for {{> art}}: the picture the section shows
    // instead when the 3D place cannot be shown (reduced motion, no WebGL, the model's two
    // files missing from assets/3d/).
    venue({ root }, args) {
        const model = 'assets/3d/venue.json', store = 'assets/3d/venue.bin';
        const picture = args.src ? artAttrs(root, args.src, args.mode, args.tall) : 'data-form="ring"';
        if (!fs.existsSync(path.join(ROOT, model)) || !fs.existsSync(path.join(ROOT, store))) return picture;
        // one version for both files: the page asks for the .bin with the .json's query
        const v = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, model))).update(fs.readFileSync(path.join(ROOT, store))).digest('hex').slice(0, 8);
        const pics = data.venuePics.map((src) => {
            if (!media[src]) throw new Error(`venue: no thumbnail recorded for "${src}" (run npm run thumbs)`);
            return root + url(media[src].src);
        });
        return `data-form="venue" data-venue="${root}${model}?v=${v}" data-venue-pics="${pics.join('|')}"${args.src ? ' ' + picture.replace('data-form="art" ', '') : ''}`;
    },

    // {{> art src=assets/images/x.jpg mode=backdrop}} inside a tag: that section shows the picture in 3D.
    art({ root }, args) {
        return artAttrs(root, args.src, args.mode, args.tall);
    },

    gallery({ root }) {
        const kinds = { image: 'Image', video: 'Video', live: 'Live' };
        const labels = [['image', 'Images'], ['video', 'Videos'], ['live', 'Live']];
        const counts = {};
        data.gallery.forEach((g) => { counts[g.type] = (counts[g.type] || 0) + 1; });
        const filters = labels.map(([k, label], i) =>
            `<button type="button" class="g-filter${i === 0 ? ' is-active' : ''}" data-filter="${k}" aria-pressed="${i === 0}">${label}<sup>${pad(counts[k] || 0)}</sup></button>`).join('\n        ');
        const cards = data.gallery.map((g, i) => {
            const m = media[g.src];
            const cap = g.caption.replace(/ \| /g, ' · ');
            const isVideo = g.type !== 'image';
            return `    <a class="g-card" href="${root}${url(g.src)}" data-type="${g.type}" data-media="${isVideo ? 'video' : 'image'}"${isVideo ? ` data-poster="${root}${url(g.poster)}"` : ''} data-title="${esc(g.title)}" data-caption="${esc(cap)}"${g.type !== 'image' ? ' hidden' : ''}>
        <img src="${root}${url(m.src)}" width="${m.width}" height="${m.height}" alt="${esc(g.title)}: ${esc(cap)}" loading="lazy" decoding="async">
        <span class="g-card__top"><span>${pad(i + 1)}</span><span>${kinds[g.type]}</span></span>
        ${isVideo ? `<span class="g-card__play">${ICON.play}</span>` : ''}
        <span class="g-card__cap"><strong>${esc(g.title)}</strong><span>${esc(cap)}</span></span>
    </a>`;
        }).join('\n');
        return `<div class="g-filters" role="group" aria-label="Filter the gallery">
        ${filters}
</div>
<div class="g-grid" id="gallery-grid" data-sv>
${cards}
</div>`;
    },

    services_teaser() {
        return `<div class="svc-grid" data-stagger>
${data.services.map((s, i) => `    <article class="card svc" data-reveal>
        <p class="card__n">${pad(i + 1)}</p>
        <h3 class="card__t">${esc(s.title)}</h3>
        <p class="card__p">${esc(s.text.match(/^.*?[.?!](?=\s|$)/)[0])}</p>
    </article>`).join('\n')}
</div>`;
    },

    services_full() {
        return `<div class="svc-grid svc-grid--full" data-stagger>
${data.services.map((s, i) => `    <article class="card svc" data-reveal>
        <p class="card__n">${pad(i + 1)}</p>
        <h3 class="card__t">${esc(s.title)}</h3>
        <p class="card__p">${esc(s.text)}</p>
        <ul class="arrows">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </article>`).join('\n')}
</div>`;
    },

    achievements({ root }) {
        return `<div class="ach-grid" data-stagger>
${data.achievements.map((a, i) => {
        const attrs = [
            a.photo ? `data-photo="${root}${url(media[a.photo.src].src)}" data-photo-alt="${esc(a.photo.alt)}"` : '',
            a.video ? `data-video="${root}${url(a.video.src)}" data-poster="${root}${url(media[a.video.poster].src)}"` : '',
            a.youtube ? `data-youtube="${a.youtube}"` : '',
            a.instagram ? `data-instagram="${a.instagram}"` : ''
        ].filter(Boolean).join(' ');
        return `    <article class="card ach" id="ach-${a.id}" data-ach data-reveal ${attrs}>
        <p class="card__n">${pad(i + 1)} <span>${esc(a.meta)}</span></p>
        <h3 class="card__t">${esc(a.title)}</h3>
        <p class="card__p">${esc(a.description)}</p>
        <div class="ach__detail" data-ach-detail>
            ${a.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n            ')}
            <h4>Key Achievements</h4>
            <ul class="arrows">${a.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
            <h4>Technologies Used</h4>
            ${tags(a.technologies)}
        </div>
        <p class="ach__foot">
            <button type="button" class="link-arrow ach__open" data-ach-open>Open details ${ICON.right}</button>
            <a class="link-arrow" href="${root}${a.link.href}">${esc(a.link.label)} ${ICON.right}</a>
        </p>
    </article>`;
    }).join('\n')}
</div>`;
    },

    // The four studio-practice write-ups, shown in full on the work index.
    practice_articles({ root }) {
        return data.achievements.filter((a) => a.onWorkIndex).map((a) => {
            const fig = [];
            if (a.photo) {
                const m = media[a.photo.src];
                fig.push(`<img src="${root}${url(m.src)}" width="${m.width}" height="${m.height}" alt="${esc(a.photo.alt)}" loading="lazy" decoding="async">`);
            }
            if (a.video) {
                fig.push(`<video controls preload="none" playsinline poster="${root}${url(media[a.video.poster].src)}"><source src="${root}${url(a.video.src)}" type="video/mp4"></video>`);
            }
            return `<article class="practice" id="${a.id}" data-reveal>
    <header class="practice__head">
        <p class="kicker"><i>${esc(a.meta)}</i></p>
        <h3 class="h3">${esc(a.title)}</h3>
    </header>
    <div class="practice__body prose">
        ${a.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}
        ${fig.length ? `<div class="practice__media${fig.length > 1 ? ' practice__media--two' : ''}">${fig.map((f) => `<figure class="frame">${f}</figure>`).join('')}</div>` : ''}
        <h4>Key achievements</h4>
        <ul class="arrows">${a.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
        <h4>Technologies</h4>
        ${tags(a.technologies)}
    </div>
</article>`;
        }).join('\n');
    },

    team({ root }) {
        const tabs = data.team.map((m, i) =>
            `<button type="button" role="tab" class="tab${i === 0 ? ' is-active' : ''}" id="team-tab-${i}" aria-controls="team-${i}" aria-selected="${i === 0}">${esc(m.name)}</button>`).join('\n        ');
        const panels = data.team.map((m, i) => {
            const ph = media[m.photo];
            const alt = m.alternatePhoto ? ` data-alt-src="${root}${url(media[m.alternatePhoto].src)}"` : '';
            let reel = '';
            if (m.showreel && m.showreel.type === 'youtube') reel = ytFacade(m.showreel.videoId, m.showreel.title);
            if (m.showreel && m.showreel.type === 'video') reel = `<div class="video frame"><video controls preload="none" playsinline><source src="${root}${url(m.showreel.src)}" type="video/mp4"></video></div>`;
            return `    <article class="team__panel${i === 0 ? ' is-active' : ''}" id="team-${i}" role="tabpanel" aria-labelledby="team-tab-${i}">
        <div class="team__photo frame"${alt}>
            <img src="${root}${url(ph.src)}" width="${ph.width}" height="${ph.height}" alt="${esc(m.name)}" loading="lazy" decoding="async">
            <div class="team__id"><p>${esc(m.role)}</p><h3>${esc(m.displayName)}</h3></div>
        </div>
        <div class="team__info">
            <h4 class="label">About</h4>
            <p>${esc(m.description)}</p>
            ${tags(m.skills)}
            ${m.profile ? `<p><a class="link-arrow" href="${root}${m.profile.href}">${esc(m.profile.label)} ${ICON.right}</a></p>` : ''}
            ${reel ? `<h4 class="label">Work Example</h4>\n            ${reel}` : ''}
        </div>
    </article>`;
        }).join('\n');
        return `<div class="team" data-tabs>
    <div class="tabs" role="tablist" aria-label="Team members">
        ${tabs}
    </div>
${panels}
</div>`;
    },

    tags(ctx, args) {
        return tags(data[args.list]);
    },

    yt(ctx, args) {
        return ytFacade(args.id, args.title);
    },

    crumbs({ root, meta }) {
        const items = [['Home', `${root}index.html`]].concat(meta.crumbs || []);
        return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([label, href], i) =>
            i === items.length - 1 ? `<li aria-current="page">${esc(label)}</li>` : `<li><a href="${href.replace('{{root}}', root)}">${esc(label)}</a></li>`).join('')}</ol></nav>`;
    },

    // "NN / total" above a project's title, from its place in the work list.
    num({ meta }) {
        const w = data.work.find((x) => x.slug === meta.slug);
        return w ? `${w.n} / ${String(data.work.length).padStart(2, '0')}` : '';
    },

    // Previous / next project, in work-list order.
    pager({ root, meta }) {
        const i = data.work.findIndex((w) => w.slug === meta.slug);
        const prev = data.work[(i - 1 + data.work.length) % data.work.length];
        const next = data.work[(i + 1) % data.work.length];
        const link = (w, label, cls) => `<a class="pager__link ${cls}" href="${root}projects/${w.slug}.html"><span class="pager__k">${label} <b>${w.n}</b></span><span class="pager__t">${esc(w.title)}</span></a>`;
        return `<nav class="pager" aria-label="More work">${link(prev, 'Previous', 'pager__link--prev')}${link(next, 'Next', 'pager__link--next')}</nav>`;
    },

    icon(ctx, args) {
        return ICON[args.name] || '';
    }
};

/* ---------- layout ---------- */

function nav(root, active) {
    const link = (key, href, label) => `<a class="nav__link${active === key ? ' is-active' : ''}" href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
    const links = [
        link('work', `${root}projects/`, 'Work'),
        link('gallery', `${root}index.html#gallery`, 'Gallery'),
        link('services', `${root}services.html`, 'Services'),
        link('about', `${root}about.html`, 'About')
    ];
    return `<header class="nav" id="main-nav">
    <a class="nav__logo" href="${root}index.html" aria-label="Relic Studios home"><img src="${root}assets/images/relic.svg" alt="Relic Studios" width="76" height="40"></a>
    <nav class="nav__links" aria-label="Primary">
        ${links.join('\n        ')}
    </nav>
    <div class="nav__end">
        <a class="nav__icon" href="${LINKS.discord}" target="_blank" rel="noopener noreferrer" aria-label="Relic Studios on Discord">${ICON.discord}<span>Discord</span></a>
        <a class="btn btn--sm" href="${root}services.html#inquiry"><span>Get a quote</span></a>
        <a class="nav__toggle" href="#site-footer" aria-controls="menu" aria-expanded="false"><span class="nav__toggle-l">Menu</span><i></i></a>
    </div>
</header>
<div class="menu" id="menu" hidden>
    <nav class="menu__links" aria-label="Menu">
        <a href="${root}index.html"><b>00</b>Home</a>
        <a href="${root}projects/"><b>01</b>Work</a>
        <a href="${root}index.html#gallery"><b>02</b>Gallery</a>
        <a href="${root}services.html"><b>03</b>Services</a>
        <a href="${root}about.html"><b>04</b>About</a>
        <a href="${root}aidan-poole.html"><b>05</b>Aidan Poole</a>
    </nav>
    <div class="menu__foot">
        <a class="btn btn--solid" href="${root}services.html#inquiry"><span>Get a quote</span></a>
        <p><a href="${LINKS.instagram}" rel="noopener">Instagram</a><a href="${LINKS.discord}" rel="noopener">Discord</a><a href="${LINKS.github}" rel="noopener">GitHub</a></p>
    </div>
</div>`;
}

function footer(root) {
    const credits = data.work.filter((w) => ['rohki-project-odyssey', 'shpongle-warfield', 'russ-tour', 'dae-v-bad-bunny', 'backstreet-boys', 'potawatomi-anniversary', 'atlas-voice'].includes(w.slug));
    return `<footer class="footer" id="site-footer">
    <div class="wrap footer__grid">
        <div class="footer__brand">
            <img src="${root}assets/images/relic.svg" alt="Relic Studios" width="122" height="64" loading="lazy">
            <p>Exploring the intersection of art and technology.</p>
        </div>
        <nav aria-label="Studio">
            <h2 class="footer__h">Studio</h2>
            <ul>
                <li><a href="${root}projects/">Work</a></li>
                <li><a href="${root}index.html#gallery">Gallery</a></li>
                <li><a href="${root}services.html">Services</a></li>
                <li><a href="${root}about.html">About</a></li>
                <li><a href="${root}get-involved.html">Get involved</a></li>
            </ul>
        </nav>
        <nav aria-label="Credits">
            <h2 class="footer__h">Credits</h2>
            <ul>
${credits.map((w) => `                <li><a href="${root}projects/${w.slug}.html">${esc(w.title)}</a></li>`).join('\n')}
            </ul>
        </nav>
        <nav aria-label="Connect">
            <h2 class="footer__h">Connect</h2>
            <ul>
                <li><a href="${LINKS.instagram}" rel="noopener">Instagram</a></li>
                <li><a href="${LINKS.linkedin}" rel="noopener">LinkedIn</a></li>
                <li><a href="${LINKS.github}" rel="noopener">GitHub</a></li>
                <li><a href="${LINKS.discord}" rel="noopener">Discord</a></li>
                <li><a href="mailto:${LINKS.email}">${LINKS.email}</a></li>
            </ul>
        </nav>
    </div>
    <div class="wrap footer__base">
        <p>© 2026 Relic Studios LLC</p>
        <p>Founded by <a href="${root}aidan-poole.html">Aidan Poole (Relic)</a></p>
        <button type="button" class="footer__motion" data-motion-toggle hidden>Motion: <b>full</b></button>
        <a class="footer__top" href="#top">Back to top</a>
    </div>
</footer>`;
}

function page(meta, headExtra, body) {
    const root = meta.root !== undefined ? meta.root : '../'.repeat(meta.out.split('/').length - 1);
    const canonical = SITE + meta.canonical;
    const ogImage = SITE + (meta.image || '/assets/images/relic.png');
    const robots = meta.noindex ? 'noindex, follow' : 'index, follow';
    const scene = meta.scene !== false;

    return `<!DOCTYPE html>
<!-- Generated by tools/build.cjs from _src/pages/${meta.source}. Edit the source, then run: npm run build -->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>${esc(meta.title)}</title>
    <meta name="description" content="${esc(meta.description)}">
${meta.keywords ? `    <meta name="keywords" content="${esc(meta.keywords)}">\n` : ''}    <meta name="author" content="${esc(meta.author || 'Relic Studios LLC')}">
    <meta name="robots" content="${robots}">
${meta.out === 'index.html' ? '    <meta name="google-site-verification" content="6NzelJfc-tmlPBiblmv2WvNgzk5-TIaSHdKCqtrlPGg">\n' : ''}    <link rel="canonical" href="${canonical}">
    <meta name="theme-color" content="#000000">

    <meta property="og:type" content="${meta.ogType || 'website'}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:title" content="${esc(meta.title)}">
    <meta property="og:description" content="${esc(meta.description)}">
    <meta property="og:image" content="${ogImage}">
    <meta property="og:site_name" content="Relic Studios">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(meta.title)}">
    <meta name="twitter:description" content="${esc(meta.description)}">
    <meta name="twitter:image" content="${ogImage}">

    <link rel="icon" type="image/png" href="${root}assets/images/relic.png">
    <link rel="apple-touch-icon" href="${root}assets/images/relic.png">

    <script async src="https://www.googletagmanager.com/gtag/js?id=G-WX0FS6PZRV"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-WX0FS6PZRV');
    </script>
    <script>
        // Motion: follows the visitor's system setting unless they chose otherwise (footer switch or ?motion=full|reduced).
        (function () {
            var d = document.documentElement, m = null;
            try { m = localStorage.getItem('relic-motion'); } catch (e) {}
            var q = /[?&]motion=(full|reduced|auto)/.exec(location.search);
            if (q) { m = q[1] === 'auto' ? null : q[1]; try { m ? localStorage.setItem('relic-motion', m) : localStorage.removeItem('relic-motion'); } catch (e) {} }
            var reduced = m ? m === 'reduced' : (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
            d.classList.add('js', reduced ? 'motion-reduced' : 'motion-full');
        })();
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Manufacturing+Consent&family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${root}css/relic.css${ver('css/relic.css')}">
${headExtra ? headExtra.trim().split('\n').map((l) => '    ' + l).join('\n') + '\n' : ''}</head>
<body class="page-${meta.id}" id="top"${meta.form ? ` data-form="${meta.form}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
<div id="canvas-container" aria-hidden="true"></div>
<div class="fx fx--dim" aria-hidden="true"></div>
<div class="fx fx--vignette" aria-hidden="true"></div>
<div class="fx fx--grain" aria-hidden="true"></div>
<div class="aura" aria-hidden="true"></div>
<div class="progress" aria-hidden="true"></div>

${nav(root, meta.nav)}

<main id="main">
${body.trim()}
</main>

${footer(root)}

<div class="hud" aria-hidden="true">
    <i class="hud__c hud__c--tl"></i><i class="hud__c hud__c--tr"></i><i class="hud__c hud__c--bl"></i><i class="hud__c hud__c--br"></i>
    <div class="hud__bar">
        <span>Relic Studios <b>/</b> TC <span data-timecode>00:00:00:00</span></span>
        <span><span data-hud-section>${esc(meta.hud || meta.id)}</span> <b>/</b> <span data-hud-pct>000</span>%</span>
    </div>
</div>
${meta.lightbox ? `
<dialog class="lightbox" id="lightbox" aria-label="Gallery viewer">
    <div class="lightbox__bar">
        <span class="lightbox__count" data-lb-count></span>
        <button type="button" class="lightbox__close" data-lb-close>Close <kbd>Esc</kbd></button>
    </div>
    <button type="button" class="lightbox__nav lightbox__nav--prev" data-lb-prev aria-label="Previous item">${ICON.right}</button>
    <figure class="lightbox__stage">
        <div class="lightbox__media" data-lb-media></div>
        <figcaption><strong data-lb-title></strong><span data-lb-caption></span></figcaption>
    </figure>
    <button type="button" class="lightbox__nav lightbox__nav--next" data-lb-next aria-label="Next item">${ICON.right}</button>
</dialog>
` : ''}${meta.achModal ? `
<dialog class="sheet" id="ach-modal" aria-labelledby="ach-modal-title">
    <button type="button" class="sheet__close" data-sheet-close>Close <kbd>Esc</kbd></button>
    <div class="sheet__inner">
        <header class="sheet__head">
            <p class="kicker"><i data-sheet-meta></i></p>
            <h2 class="h2" id="ach-modal-title" data-sheet-title></h2>
        </header>
        <div class="sheet__body">
            <div class="sheet__media" data-sheet-media></div>
            <div class="sheet__text prose" data-sheet-text></div>
        </div>
    </div>
</dialog>
` : ''}
${scene ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/misc/GPUComputationRenderer.js" defer></script>
<script src="${root}js/gpgpu-starfield.js${ver('js/gpgpu-starfield.js')}" defer></script>
<script src="${root}js/simple-bloom.js${ver('js/simple-bloom.js')}" defer></script>
<script src="${root}js/artscene.js${ver('js/artscene.js')}" defer></script>
<script src="${root}js/venue.js${ver('js/venue.js')}" defer></script>
<script src="${root}js/main.js${ver('js/main.js')}" defer></script>
` : ''}<script src="${root}js/site.js${ver('js/site.js')}" defer></script>
<script src="${root}js/analytics.js${ver('js/analytics.js')}" defer></script>
</body>
</html>
`;
}

/* ---------- build ---------- */

function render(file) {
    const raw = fs.readFileSync(path.join(SRC, 'pages', file), 'utf8').replace(/\r\n/g, '\n');
    const metaMatch = raw.match(/^<!--meta\s*([\s\S]*?)-->/);
    if (!metaMatch) throw new Error(`${file}: missing <!--meta ... --> block`);
    let meta;
    try { meta = JSON.parse(metaMatch[1]); } catch (e) { throw new Error(`${file}: meta is not valid JSON (${e.message})`); }
    meta.source = file;
    let rest = raw.slice(metaMatch[0].length);
    let headExtra = '';
    const headMatch = rest.match(/<!--head\s*([\s\S]*?)head-->/);
    if (headMatch) { headExtra = headMatch[1]; rest = rest.replace(headMatch[0], ''); }

    const root = meta.root !== undefined ? meta.root : '../'.repeat(meta.out.split('/').length - 1);
    const ctx = { root, meta };
    const fill = (s) => s
        .replace(/\{\{>\s*(\w+)([^}]*)\}\}/g, (m, name, argStr) => {
            if (!PARTIALS[name]) throw new Error(`${file}: unknown partial "${name}"`);
            const args = {};
            argStr.replace(/(\w+)=(?:"([^"]*)"|(\S+))/g, (mm, k, q, b) => { args[k] = q !== undefined ? q : b; return mm; });
            return PARTIALS[name](ctx, args);
        })
        .replace(/\{\{root\}\}/g, root)
        .replace(/\{\{site\}\}/g, SITE);

    const html = page(meta, fill(headExtra), fill(rest));
    const out = path.join(ROOT, meta.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    return meta;
}

function main() {
    const files = fs.readdirSync(path.join(SRC, 'pages')).filter((f) => f.endsWith('.html')).sort();
    const metas = files.map(render);

    const order = (m) => (m.sitemapOrder !== undefined ? m.sitemapOrder : 50);
    const urls = metas.filter((m) => !m.noindex && m.sitemap !== false)
        .sort((a, b) => order(a) - order(b) || a.canonical.localeCompare(b.canonical))
        .map((m) => `<url><loc>${SITE}${m.canonical}</loc></url>`);
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

    console.log(`Built ${metas.length} pages:`);
    metas.forEach((m) => console.log(`  ${m.out}`));
    console.log(`sitemap.xml: ${urls.length} URLs`);
}

main();
