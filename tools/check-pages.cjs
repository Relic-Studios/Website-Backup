/**
 * Relic Studios page checker.
 *
 * Checks the built pages before they are published. The live site is GitHub Pages serving
 * the repository root, so a mistake here is a mistake on relicstudios.xyz.
 *
 * Usage: node tools/check-pages.cjs      (or: npm run check, which builds first)
 * Exits with code 1 if any check fails. No dependencies.
 *
 * What it checks:
 *   1. Every page has one <title>, one description, one <h1> and the right canonical URL.
 *   2. sitemap.xml lists exactly the pages that should be indexed.
 *   3. Every local link, image, video and stylesheet exists with the same upper/lower case
 *      (GitHub is case-sensitive, Windows is not), is not git-ignored (ignored files never
 *      reach the live site) and has no folder starting with "_" or "." (GitHub Pages skips those).
 *   4. Every #anchor points at an id that exists on the target page.
 *   5. Structured data (JSON-LD) parses and uses the agreed ids for Aidan Poole and the studio.
 *   6. Wording rules for the profile and project pages (see _src/README.md).
 *   7. The two forms still send the same fields to the same place as the published site.
 *   8. Type and logo rules: no italic or Instrument Serif; logo files unchanged.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://relicstudios.xyz';
const PERSON_ID = SITE + '/#aidan-poole';
const ORG_ID = SITE + '/#organization';
const LOGO_FILES = ['assets/images/relic.svg', 'assets/images/relic.png'];

const problems = [];
const notes = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const git = (args) => execSync('git ' + args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

/* ---------- pages ---------- */

const pages = fs.readdirSync(path.join(ROOT, '_src', 'pages')).filter((f) => f.endsWith('.html')).map((f) => {
    const src = read('_src/pages/' + f);
    const m = src.match(/^\s*<!--meta\s*([\s\S]*?)-->/);
    if (!m) { fail('_src/pages/' + f, 'no <!--meta ... --> block'); return null; }
    let meta;
    try { meta = JSON.parse(m[1]); } catch (e) { fail('_src/pages/' + f, 'meta is not valid JSON: ' + e.message); return null; }
    if (!fs.existsSync(path.join(ROOT, meta.out))) { fail(meta.out, 'not built (run node tools/build.cjs)'); return null; }
    const html = read(meta.out);
    return { src: f, out: meta.out, meta, html, ids: new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1])) };
}).filter(Boolean);
const pageByOut = new Map(pages.map((p) => [p.out, p]));

/* ---------- files that would be published ---------- */

let publishable = null;
try {
    publishable = new Set(git('ls-files -z --cached --others --exclude-standard').split('\0').filter((f) => f && fs.existsSync(path.join(ROOT, f))));
} catch (e) {
    notes.push('git not available: skipped the upper/lower-case and git-ignore checks on file references');
}
const isPublished = (rel) => (publishable ? publishable.has(rel) : fs.existsSync(path.join(ROOT, rel)));

function checkRef(where, fromDir, raw, kind) {
    let ref = raw.trim().replace(/&amp;/g, '&');
    if (!ref || /^(mailto:|tel:|data:|javascript:|blob:|\/\/)/i.test(ref)) return;
    if (/^https?:/i.test(ref)) {
        if (!ref.startsWith(SITE + '/') && ref !== SITE) return; // external
        ref = ref.slice(SITE.length) || '/';
    }
    let frag = '';
    const h = ref.indexOf('#');
    if (h >= 0) { frag = ref.slice(h + 1); ref = ref.slice(0, h); }
    ref = ref.split('?')[0];
    let rel;
    if (ref === '') rel = where; // same page
    else {
        try { ref = decodeURIComponent(ref); } catch (e) { fail(where, `badly encoded ${kind} "${raw}"`); return; }
        rel = ref.startsWith('/') ? path.posix.normalize(ref.slice(1)) : path.posix.normalize(path.posix.join(fromDir, ref));
        if (rel === '.' || rel === '') rel = 'index.html';
        else if (rel.endsWith('/')) rel += 'index.html';
        if (rel.startsWith('..')) { fail(where, `${kind} "${raw}" points outside the site`); return; }
        if (rel.split('/').some((seg) => seg.startsWith('_') || seg.startsWith('.'))) fail(where, `${kind} "${raw}" is in a folder GitHub Pages will not publish`);
        if (!isPublished(rel)) {
            const exists = fs.existsSync(path.join(ROOT, rel));
            fail(where, `${kind} "${raw}" -> ${rel} ${exists ? 'exists here but will not be on the live site (wrong upper/lower case, or git-ignored)' : 'does not exist'}`);
            return;
        }
    }
    if (frag && frag !== 'top') {
        const target = pageByOut.get(rel);
        if (target && !target.ids.has(frag)) fail(where, `${kind} "${raw}": no element with id="${frag}" on ${rel}`);
    }
}

const REF_ATTRS = ['href', 'src', 'poster', 'data-poster', 'data-video', 'data-photo', 'data-alt-src', 'data-src', 'data-full', 'data-art', 'data-art-full', 'data-depth', 'data-art-tall', 'data-art-tall-full', 'data-depth-tall'];
const count = (html, re) => (html.match(re) || []).length;

const sitemapWanted = new Set();
const defined = new Set(); // JSON-LD ids that some page defines
const referenced = []; // [page, id]

for (const p of pages) {
    const { out, html, meta } = p;
    const dir = path.posix.dirname(out) === '.' ? '' : path.posix.dirname(out);

    // 1. head basics
    if (count(html, /<title>/g) !== 1) fail(out, 'needs exactly one <title>');
    if (count(html, /<meta name="description"/g) !== 1) fail(out, 'needs exactly one meta description');
    if (count(html, /<h1[\s>]/g) !== 1) fail(out, `needs exactly one <h1> (found ${count(html, /<h1[\s>]/g)})`);
    const canon = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((x) => x[1]);
    if (canon.length !== 1 || canon[0] !== SITE + meta.canonical) fail(out, `canonical should be ${SITE + meta.canonical}, found ${canon.join(', ') || 'none'}`);
    if (!/<html lang="/.test(html)) fail(out, 'missing <html lang>');
    const noindex = /<meta name="robots" content="noindex/.test(html);
    if (!!meta.noindex !== noindex) fail(out, 'robots tag does not match the page meta');
    if (!meta.noindex && meta.sitemap !== false) sitemapWanted.add(SITE + meta.canonical);

    // 3 + 4. references
    for (const attr of REF_ATTRS) {
        for (const m of html.matchAll(new RegExp(`\\s${attr}="([^"]*)"`, 'g'))) checkRef(out, dir, m[1], attr);
    }
    for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) m[1].split(',').forEach((c) => checkRef(out, dir, c.trim().split(/\s+/)[0], 'srcset'));
    for (const m of html.matchAll(/<meta (?:property|name)="(?:og:image|twitter:image|og:url)" content="([^"]+)"/g)) checkRef(out, dir, m[1], 'meta');

    // 5. JSON-LD
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        let doc;
        try { doc = JSON.parse(m[1]); } catch (e) { fail(out, 'JSON-LD does not parse: ' + e.message); continue; }
        (function walk(node) {
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (!node || typeof node !== 'object') return;
            const types = [].concat(node['@type'] || []);
            const id = node['@id'];
            if (id) {
                if (types.length) defined.add(id); else referenced.push([out, id]);
            }
            if (types.includes('Person') && node.name === 'Aidan Poole' && id !== PERSON_ID) fail(out, `JSON-LD Person "Aidan Poole" must use @id ${PERSON_ID} (found ${id || 'none'})`);
            if (types.includes('Organization') && /^Relic Studios/.test(node.name || '') && id !== ORG_ID) fail(out, `JSON-LD Organization "${node.name}" must use @id ${ORG_ID} (found ${id || 'none'})`);
            Object.values(node).forEach(walk);
        })(doc);
    }
}
for (const [out, id] of referenced) {
    if (id.startsWith(SITE) && !defined.has(id)) fail(out, `JSON-LD points at ${id}, which no page defines`);
}

// stylesheet url() references
for (const css of fs.readdirSync(path.join(ROOT, 'css')).filter((f) => f.endsWith('.css'))) {
    const text = read('css/' + css);
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        if (/^(#|%23)/.test(m[1])) continue; // a filter reference inside an inline SVG, not a file
        checkRef('css/' + css, 'css', m[1], 'url()');
    }
    // 8. type rule
    if (/Instrument Serif/i.test(text)) fail('css/' + css, 'uses Instrument Serif (type rule: mono capitals + chrome blackletter, no serif accents)');
    if (/font-style:\s*italic/i.test(text)) fail('css/' + css, 'uses italic type (type rule: no italics)');
}
for (const p of pages) if (/Instrument\+Serif/i.test(p.html)) fail(p.out, 'loads the Instrument Serif font');

/* ---------- 2. sitemap ---------- */

const sitemap = new Set([...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
for (const u of sitemapWanted) if (!sitemap.has(u)) fail('sitemap.xml', 'missing ' + u);
for (const u of sitemap) if (!sitemapWanted.has(u)) fail('sitemap.xml', 'lists ' + u + ', which is not an indexable page');
if (!/Sitemap:\s*https:\/\/relicstudios\.xyz\/sitemap\.xml/.test(read('robots.txt'))) fail('robots.txt', 'does not point at the sitemap');
if (read('CNAME').trim() !== 'relicstudios.xyz') fail('CNAME', 'must contain relicstudios.xyz (GitHub Pages custom domain)');

/* ---------- 6. wording rules on the profile and project pages ---------- */

const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, (s) => (s.includes('ld+json') ? s : '')).replace(/<style[\s\S]*?<\/style>/g, '');
const main = (html) => { const m = html.match(/<main[\s\S]*?<\/main>/); return m ? m[0] : html; };
for (const p of pages) {
    const isNew = p.out === 'aidan-poole.html' || p.out.startsWith('projects/');
    const body = text(main(p.html));
    if (isNew) {
        const banned = [
            [/first AI-assisted anime/i, '"first AI-assisted anime"'],
            [/Ikhor/i, 'Ikhor Labs'],
            [/\b(TBD|coming soon)\b/i, 'a placeholder (TBD / coming soon)'],
            [/\b(founded|established|since) in? ?(19|20)\d\d/i, 'a founding year']
        ];
        for (const [re, label] of banned) if (re.test(body)) fail(p.out, 'mentions ' + label);
    }
    if (p.out === 'projects/streamdiffusion-notch.html' || p.out === 'projects/backstreet-boys.html') {
        // Nothing is known about how the StreamDiffusion work was wired up or how fast it ran.
        if (/\b(Spout|NDI|OSC)\b/.test(body)) fail(p.out, 'mentions an integration method (Spout / NDI / OSC) that is not known');
        if (/\b\d+(\.\d+)?\s?(fps|frames per second|ms)\b/i.test(body)) fail(p.out, 'mentions a performance figure that is not known');
    }
    // The Project Odyssey prize is a team award wherever it appears.
    if (/first[- ]prize/i.test(body) && !/team|PixelPoetryX/i.test(body)) fail(p.out, 'mentions the first prize without saying it is a team award');
    if (p.out === 'projects/atlas-voice.html') {
        if (!/free to use and closed source/i.test(body)) fail(p.out, 'must say ATLAS is "free to use and closed source"');
        if (/open[- ]source/i.test(body.replace(/closed source/gi, ''))) fail(p.out, 'must not call ATLAS open source');
    }
    if (p.out === 'projects/backstreet-boys.html') {
        // Text-only credit: no show imagery or footage on this page.
        if (/<img|<video|<iframe|data-yt=|<picture/i.test(main(p.html))) fail(p.out, 'must stay text only (no images, video or embeds)');
    }
}

/* ---------- 7. forms keep their fields ---------- */

function formShape(html, id) {
    const m = html.match(new RegExp(`<form[^>]*id="${id}"[^>]*>[\\s\\S]*?</form>`));
    if (!m) return null;
    const form = m[0];
    const plain = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); // as a browser reads the value
    const attr = (tag, name) => { const x = tag.match(new RegExp(`\\s${name}="([^"]*)"`)); return x ? plain(x[1]) : ''; };
    const open = form.match(/<form[^>]*>/)[0];
    const fields = [...form.matchAll(/<(input|select|textarea)\b[^>]*>/g)].map((x) => x[0]).filter((t) => attr(t, 'name'));
    return {
        action: attr(open, 'action'), method: attr(open, 'method').toUpperCase(), name: attr(open, 'name'),
        fields: fields.map((t) => attr(t, 'name') + (/\srequired\b/.test(t) ? '*' : '')).sort(),
        hidden: fields.filter((t) => attr(t, 'type') === 'hidden').map((t) => attr(t, 'name') + '=' + attr(t, 'value')).sort(),
        options: [...form.matchAll(/<option[^>]*value="([^"]*)"/g)].map((x) => plain(x[1]))
    };
}
for (const [file, id] of [['services.html', 'inquiry-form'], ['get-involved.html', 'community-application-form']]) {
    const now = formShape(read(file), id);
    if (!now) { fail(file, `form #${id} is missing`); continue; }
    if (now.action !== 'https://api.web3forms.com/submit' || now.method !== 'POST') fail(file, `form #${id} must POST to https://api.web3forms.com/submit`);
    let before = null;
    try { before = formShape(git(`show origin/main:${file}`), id); } catch (e) { notes.push(`${file}: could not read the published version from git, so the form was not compared with it`); }
    if (before) {
        for (const key of ['action', 'method', 'name', 'fields', 'hidden', 'options']) {
            if (JSON.stringify(before[key]) !== JSON.stringify(now[key])) fail(file, `form #${id}: ${key} differs from the published site\n      published: ${JSON.stringify(before[key])}\n      now:       ${JSON.stringify(now[key])}`);
        }
    }
}

/* ---------- 8. logo files are never changed ---------- */

for (const f of LOGO_FILES) {
    if (!fs.existsSync(path.join(ROOT, f))) { fail(f, 'logo file is missing'); continue; }
    try { git(`diff --quiet origin/main -- "${f}"`); } catch (e) { if (e.status === 1) fail(f, 'logo file differs from the published one (the logo is never changed)'); }
}

/* ---------- report ---------- */

console.log(`Checked ${pages.length} pages, ${sitemap.size} sitemap URLs${publishable ? `, ${publishable.size} publishable files` : ''}.`);
notes.forEach((n) => console.log('note: ' + n));
if (problems.length) {
    console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
    problems.forEach((p) => console.log('  - ' + p));
    process.exit(1);
}
console.log('All checks passed.');
