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
js/main.js          the starfield scene and its camera
js/gpgpu-starfield.js, js/simple-bloom.js   the star simulation and the glow
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
  (the `goth` class, font "Manufacturing Consent"), echoing the logo. No italics and no serif
  accent words.
- **Look.** Black background, live starfield, cyan `#00ced1` with a little violet `#a98bff`, thin
  frames with corner ticks, glass panels, a status line along the bottom edge.
- **Starfield.** The stars gather into a shape per section: cloud, galaxy, ring, crescent, helix or
  an LED-stage wall. A section picks its shape with `data-form="..."`.
- **Motion.** Visitors whose device asks for reduced motion get a calm version. The footer has a
  switch, and `?motion=full` or `?motion=reduced` in the address forces either one.

## Forms

Both forms (project inquiry on Services, community application on Get Involved) post straight to
web3forms, which emails the submission. `npm run check` fails if a field name, option or hidden
value changes, because that would change the emails that arrive.

## Contact

relicvisuals404@gmail.com
