# Site source

This folder is not published (GitHub Pages skips folders that start with `_`). It holds what the
pages are built from. After any change here, run `npm run check` from the repository root.

## Page files (`pages/*.html`)

Each file is one page. It starts with a settings block, then optional extra `<head>` tags, then the
page's own HTML:

```html
<!--meta
{ "out": "about.html", "canonical": "/about.html", "title": "...", "description": "...", "nav": "about", "form": "crescent" }
-->
<!--head
<script type="application/ld+json"> ... </script>
head-->
<section class="page-hero" data-section="About" data-form="crescent"> ... </section>
```

Settings: `out` (file to write), `canonical` (path on the live site), `title`, `description`,
`nav` (which menu item is lit), `hud` (label in the bottom status line), `form` (star shape the page
opens with), `sitemapOrder`, `noindex`, `crumbs` (breadcrumb trail), `slug` (project pages: which
work-list row this is), `image` (share image), `lightbox` / `achModal` (include those dialogs).

Tokens: `{{root}}` (path back to the site root), `{{site}}` (`https://relicstudios.xyz`), and
shared blocks written as `{{> name key=value}}`:

| Block | Output |
|---|---|
| `worklist [group=credits\|software]` | the numbered work list |
| `ticker` | scrolling strip of project names |
| `gallery` | gallery grid with filters |
| `showcase` | the gallery viewer: one picture at a time shown as a 3D scene; the visitor changes it (the list is `showcase` in `data.cjs`) |
| `art src=assets/images/x.jpg [mode=backdrop] [tall=assets/images/y.jpg]` | written inside a section's opening tag: that section shows the picture as a 3D scene |
| `venue src=assets/images/x.jpg [mode=backdrop] [tall=assets/images/y.jpg]` | written inside a section's opening tag: that section stands in the truss cathedral (see below); `src`, `mode` and `tall` name the picture shown where the 3D place cannot be |
| `services_teaser`, `services_full` | service cards |
| `achievements` | achievement cards (About) |
| `practice_articles` | the same achievement texts written out in full (Work index) |
| `team` | team tabs |
| `tags list=practice` | tag list |
| `yt id=... title="..."` | YouTube preview that loads the player on click |
| `crumbs`, `pager` | breadcrumbs, previous/next project |
| `icon name=arrow\|right\|play\|discord` | inline icon |

### Pictures as 3D scenes

While a section with `{{> art src=...}}` in its opening tag holds the middle of the window, the 3D
background builds that picture out of the stars. Without `mode` the picture stands beside the text;
with `mode=backdrop` it fills the window behind the text. A backdrop is cropped to fill the window,
so a wide picture loses its sides on a phone: `tall=` names a second, upright picture to use when
the window is taller than it is wide. Put a path that contains spaces in quotes. Example:

```html
<section class="sec cta" data-section="Contact" {{> art src=assets/images/pretty.jpg tall="assets/images/thelostgirl4 (00000).jpg" mode=backdrop}}>
```

A `cta` block with a backdrop gets a soft dark patch behind its words (in `css/relic.css`), so
bright pictures do not wash out the text. Check any new picture behind real text before keeping it.

To add a picture:

1. It needs a web-size copy: put it in the gallery list in `data.cjs` and run `npm run thumbs`.
2. For the showcase, add its path to `showcase` in `data.cjs`.
3. Make its depth map (this is what gives it relief): `python tools/make-depth.py assets/images/<file>`.
   The tool's header says which Python to use. Without a depth map the picture still shows, flatter.
4. `npm run check`.

Visitors with reduced motion, or without WebGL, see the same pictures as plain images.

### The truss cathedral

`{{> venue ...}}` in a section's opening tag puts that section in the 3D place drawn by
`js/venue.js` (model: `assets/3d/venue.json` and `venue.bin`). It is used once, on the closing
block of the home page:

```html
<section class="sec sec--line cta cta--venue" id="contact" data-section="Contact" {{> venue src=assets/images/pretty.jpg tall="assets/images/thelostgirl4 (00000).jpg" mode=backdrop}}>
```

- The pictures on its LED wall are `venuePics` in `data.cjs` (upright pictures suit the wall;
  each needs its web-size copy, as above).
- The class `cta--venue` makes the block one window high with its words at the foot, so the wall
  has the upper half. The camera measures where the words (`.wrap`) begin and stands so that the
  whole wall fits between the menu bar and the words, on any screen.
- The model is made with the scripts in `tools/venue/`. `npm run check` fails if the model's
  `.bin` file or one of the wall's pictures is missing, or if the model is the test stand-in.
- If the model's two files are missing the block is built as an ordinary `{{> art}}` section.

Headings: one word may be wrapped as `<span class="goth" data-keep>Word</span>` to set it in chrome
blackletter. One per heading at most. A name counts as one word and is never split: when the
heading ends on the studio's name, both words go in the span (`<span class="goth" data-keep>Relic
Studios</span>`), not "Studios" alone.

## Wording rules for credits

These protect the credits from being challenged. `npm run check` enforces the ones a script can test.

- No sentence says or implies a direct contract with a performer, venue or club. Name the producing
  company where it is known (36North for Dae-V); otherwise name only the work and the place.
- The Project Odyssey first prize is a team award. Wherever it appears, say so or list the credited
  team: ROHKI, RelicVisuals, PixelPoetryX, Mrboofy.
- ATLAS is "free to use and closed source". Never call it open source.
- StreamDiffusion work: no performance numbers, model names, dataset sizes or integration methods.
  None are documented.
- Backstreet Boys: text credit only. No show images, footage or embeds. The tour's content is not
  shared; official posts may only be reposted unaltered, under terms the owner has by email.
  If the credit is ever withdrawn, remove: the page `projects-backstreet-boys.html`, its row in the
  work list in `data.cjs` (this also removes it from the ticker, footer and sitemap), the biography
  sentence on `aidan-poole.html`, and the redirect page `projects-streamdiffusion-notch.html`
  (the StreamDiffusion and Notch work was part of this project, merged 2026-11-18).
- New text carries no founding year for the studio, no employment dates and no placeholders
  ("TBD", "coming soon"). Unknown facts are left out.
- Names are written exactly: Aidan Poole, Relic, RelicVisuals, @relic.visuals, Relic Studios,
  Relic Studios LLC, Dae-V, 36North, RŌHKI – Episode 1 Trailer (the film), Rohki (the series and
  company), ATLAS Voice, ATLAS, Engram.
- Structured data uses fixed ids: Aidan Poole is `https://relicstudios.xyz/#aidan-poole`, the studio
  is `https://relicstudios.xyz/#organization`, the site is `https://relicstudios.xyz/#website`.
