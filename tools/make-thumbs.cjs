/**
 * Makes small web versions of the gallery stills, video posters and headshots,
 * and records their sizes in _src/media.json for tools/build.cjs.
 *
 * Usage: node tools/make-thumbs.cjs   (or: npm run thumbs)
 * Originals are never changed.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const { gallery, team, achievements } = require(path.join(ROOT, '_src', 'data.cjs'));

const slug = (p) => path.basename(p).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function derive(input, output, maxW, maxH) {
    const inPath = path.join(ROOT, input);
    const outPath = path.join(ROOT, output);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const img = sharp(inPath).rotate().resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true });
    const isJpg = /\.jpe?g$/i.test(output);
    const info = await (isJpg ? img.jpeg({ quality: 82, mozjpeg: true }) : img.webp({ quality: 78 })).toFile(outPath);
    return { src: output, width: info.width, height: info.height };
}

(async () => {
    const media = {};
    for (const item of gallery) {
        const source = item.poster || item.src;
        media[item.src] = await derive(source, `assets/images/gallery/${slug(source)}.webp`, 960, 1280);
    }
    for (const a of achievements) {
        if (a.photo) media[a.photo.src] = await derive(a.photo.src, `assets/images/gallery/${slug(a.photo.src)}-wide.webp`, 1400, 1400);
        if (a.video) media[a.video.poster] = await derive(a.video.poster, `assets/images/gallery/${slug(a.video.poster)}-poster.webp`, 1100, 1400);
    }
    for (const m of team) {
        media[m.photo] = await derive(m.photo, `assets/HeadShots/web/${slug(m.photo)}.webp`, 800, 1400);
        if (m.alternatePhoto) media[m.alternatePhoto] = await derive(m.alternatePhoto, `assets/HeadShots/web/${slug(m.alternatePhoto)}.webp`, 800, 1400);
    }
    // JPEG copy of the founder portrait for share cards and structured data.
    media['portrait-jpg'] = await derive('assets/HeadShots/aidanpooleheadshot.jpg', 'assets/HeadShots/web/aidan-poole.jpg', 800, 1400);

    fs.writeFileSync(path.join(ROOT, '_src', 'media.json'), JSON.stringify(media, null, 2) + '\n');
    console.log(`Wrote ${Object.keys(media).length} derivatives and _src/media.json`);
})().catch((e) => { console.error(e); process.exit(1); });
