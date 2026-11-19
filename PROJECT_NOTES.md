# Relic Studios website: project notes

Last updated: 2026-11-16

## Where the site lives

- **Live site:** https://relicstudios.xyz
- **Host:** GitHub Pages. Repository `Relic-Studios/Website-Backup`, branch `main`, served from the
  repository root. GitHub rebuilds the site a minute or two after every push to `main`.
- **Domain:** `relicstudios.xyz`, set by the `CNAME` file in this folder. The DNS records are managed
  at GoDaddy and point at GitHub. Nothing there needs to change when the site is updated.
- **Not Netlify.** The site was on Netlify in 2025 (`relicstudios.netlify.app`, which no longer
  exists). `netlify.toml`, `.netlifyignore` and the `netlify/` folder are leftovers and do nothing.

## How to publish a change

1. Edit the source (see below), never the built `.html` files in this folder.
2. `npm run check` builds the pages and checks them. Fix anything it reports.
3. Look at the result: `npm start`, then open http://localhost:8001.
4. Commit, then push to `main`. That is the upload.

Three things GitHub Pages does differently from a Windows PC, all covered by `npm run check`:

- File names are case-sensitive: `Relic.PNG` and `relic.png` are different files there.
- Files listed in `.gitignore` are never uploaded, so a page must not link to them.
- Folders whose names start with `_` or `.` are not published.

## How the site is built

It is a plain static site: no framework, nothing runs on a server.

```
_src/pages/*.html   one file per page: the page's own content, with a small settings block on top
_src/data.cjs       shared content: work list, gallery items, services, team, achievements, links
_src/media.json     image sizes (written by tools/make-thumbs.cjs)
_src/README.md      how the page files work, and the wording rules for credits
tools/build.cjs     wraps every page in the shared head, navigation and footer -> *.html, projects/*.html, sitemap.xml
tools/check-pages.cjs   the checks behind `npm run check`
css/relic.css       all styles
js/site.js          page behaviour: menu, reveals, gallery and lightbox, tabs, video click-to-load
js/main.js          the 3D background: which shape or picture is showing, and the camera
js/gpgpu-starfield.js   the star simulation
js/artscene.js      pictures as 3D scenes: the sheet with relief, and where each star goes
js/simple-bloom.js  how a frame is put together: star glow, the picture, pointer ripple, scroll stretch
js/venue.js         the truss cathedral: the 3D place the home page ends in
assets/3d/          its model (venue.json + venue.bin), made in Blender
tools/venue/        the scripts that make that model (see the README there)
tools/make-depth.py depth maps for the pictures shown as 3D scenes (assets/images/depth/)
js/analytics.js     analytics
assets/             images, videos, headshots
```

Commands:

| Command | What it does |
|---|---|
| `npm run build` | Rebuild every page and the sitemap |
| `npm run check` | Rebuild, then run all checks |
| `npm run thumbs` | Make web-size gallery images after adding new media |
| `npm start` | Local preview at http://localhost:8001 |

To add a project page: copy one of `_src/pages/projects-*.html`, add its row to the work list in
`_src/data.cjs`, and run `npm run check`.

## Design rules

- **The logo is never changed.** `assets/images/relic.svg` and `assets/images/relic.png` stay as they
  are. `npm run check` fails if they differ from the published files.
- **Type.** Headings are JetBrains Mono, light weight, capitals, wide letter-spacing. Body text is
  Inter. Labels are JetBrains Mono. At most one word in a heading is set in chrome blackletter
  (the `goth` class, font "Manufacturing Consent"), echoing the logo. A name counts as one word:
  "Relic Studios" is set whole in blackletter, never "Studios" alone. No italics and no serif
  accent words.
- **Look.** Black background, live starfield, cyan `#00ced1` with a little violet `#a98bff`, thin
  frames with corner ticks, glass panels, a status line along the bottom edge.
- **Starfield.** The stars gather into a shape per section: cloud, galaxy, ring, crescent, helix or
  an LED-stage wall. A section picks its shape with `data-form="..."`.
- **Artwork as 3D scenes.** A section can show a picture instead of a shape: the stars gather into
  it as coloured points, the picture burns in over them as a sheet with real relief, and it turns
  with the pointer and the scroll. Standing still, a picture takes about a second and a half to
  form; scrolling into its section brings it in faster, so a steady scroll still shows each one.
  Where it is used: the viewer at the top of the home page gallery (pictures listed in
  `showcase` in `_src/data.cjs`), and a full-window scene behind the closing block of the
  About, Get Involved and Aidan Poole pages. Project pages have none (they stay text only). How to
  add one is in `_src/README.md`.
- **Gallery viewer (home page).** One picture at a time. The visitor changes it by clicking or
  tapping the left or right side of the picture, swiping, the arrow keys or the rail under it;
  until they first do, the pictures change by themselves. A change by hand sweeps sideways: the
  old picture swings off like a turning panel and the stars gust and regroup. Scrolling only
  moves down the page.
- **The truss cathedral (home page, closing block).** The home page ends in a place built in 3D:
  a nave of pointed arches made of stage truss, with a tall LED wall that plays the studio's
  pictures (`venuePics` in `_src/data.cjs`). It belongs to the "Let's create something Epic"
  block: it rises into the window with that block, its pieces fly in from the sides and lock
  together, the wall stands right above the words. When the footer comes it stops rising with
  them and the camera steps back, so the nave and the wall stay behind the block to the very end
  of the page (the owner did not want only the floor left there). A click on the scene puts the
  next picture on the wall. It must look like part of the page: worn aluminium on black (shaded in
  js/venue.js from position, since the model has no texture coordinates: scuffs, pits, grime near
  the floor, highlights along the tubes, the wall's picture mirrored in the metal), a floor of
  black stage decks that mirror the wall unevenly. Two tileable surface textures sit beside the
  model, `assets/3d/truss-aluminium.jpg` (projected from three axes onto the truss) and
  `assets/3d/stage-deck.jpg` (each deck shows its own part): made with Krea 2 on BossLvl and
  flattened and tiled by `work/lab/tex/prep.py`. They are room materials, not studio artwork.
  Without them the shaders fall back to their own procedural wear; stars along the truss, the picture on the wall
  the only colour.
  Visitors with reduced motion or without WebGL get the ordinary block instead.
- **Calm at the top.** The stars keep one shape (the open cloud) from the top of the home page
  down to the gallery. Shape changes are for the lower sections. The owner found more than that
  "too crowded".
- **The studio's artwork is 3D work, never AI.** It is made in Cinema 4D and rendered in Octane.
  No caption or description calls a piece AI-generated, AI-assisted or generative.
- **Contact buttons.** The buttons that lead to a form show blinking cyan arrows on hover
  (`.nudge` in `css/relic.css`).
- **Pointer and scroll.** Moving the pointer fast across a picture breaks it into a lattice of
  light points that closes again; a click or tap sends a ring through it; fast scrolling bows and
  smears the whole background. Stars swerve away from the pointer while it moves.
- **Slow devices.** If most frames take too long, `js/main.js` draws the background with fewer
  pixels, one step at a time, and undoes a step that did not help.
- **Blackletter size.** The `goth` word sits on the same baseline as the capitals and is sized
  (1.71em) so its lowercase letters are exactly as tall as them. Do not give it another size or a
  vertical offset anywhere.
- **Motion.** Visitors whose device asks for reduced motion get a calm version: slower stars, no
  pointer or scroll effects, and pictures as plain images instead of 3D scenes. The footer has a
  switch, and `?motion=full` or `?motion=reduced` in the address forces either one. (Windows
  with "Animation effects" turned off counts as asking for reduced motion.)

## Forms

Both forms (project inquiry on Services, community application on Get Involved) post straight to
web3forms, which emails the submission. `npm run check` fails if a field name, option or hidden
value changes, because that would change the emails that arrive.

## Contact

relicvisuals404@gmail.com
