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
| `services_teaser`, `services_full` | service cards |
| `achievements` | achievement cards (About) |
| `practice_articles` | the same achievement texts written out in full (Work index) |
| `team` | team tabs |
| `tags list=practice` | tag list |
| `yt id=... title="..."` | YouTube preview that loads the player on click |
| `crumbs`, `pager` | breadcrumbs, previous/next project |
| `icon name=arrow\|right\|play\|discord` | inline icon |

Headings: one word may be wrapped as `<span class="goth" data-keep>Word</span>` to set it in chrome
blackletter. One per heading at most.

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
  sentence on `aidan-poole.html`, and the "See also" line on `projects-streamdiffusion-notch.html`.
- New text carries no founding year for the studio, no employment dates and no placeholders
  ("TBD", "coming soon"). Unknown facts are left out.
- Names are written exactly: Aidan Poole, Relic, RelicVisuals, @relic.visuals, Relic Studios,
  Relic Studios LLC, Dae-V, 36North, RŌHKI – Episode 1 Trailer (the film), Rohki (the series and
  company), ATLAS Voice, ATLAS, Engram.
- Structured data uses fixed ids: Aidan Poole is `https://relicstudios.xyz/#aidan-poole`, the studio
  is `https://relicstudios.xyz/#organization`, the site is `https://relicstudios.xyz/#website`.
