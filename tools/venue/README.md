# The truss cathedral: how its model is made

The 3D place at the foot of the home page is drawn by `js/venue.js` from two files,
`assets/3d/venue.json` and `assets/3d/venue.bin`. These scripts make those files. Nothing here
runs when the site is built; run them only to change the model.

Made with Blender 4.4.3 (`C:\Program Files\Blender Foundation\Blender 4.4\blender.exe`, Cycles
on the GPU) and Python 3.12 with numpy. Run from the site's root folder.

## Rebuild, in order

```bash
"C:/Program Files/Blender Foundation/Blender 4.4/blender.exe" --background --python tools/venue/bake.py
```

Builds the mesh from `venue_geo.py` and bakes its light into every vertex, twice: lit by the LED
wall only (its faces emit white, plus a small disc light at its hot centre that gives crisp
shadows), and lit by everything else. Then bakes the wall's light on the floor a second time into
a 1024 x 1280 picture, which holds the lattice's shadows. About 10 minutes at the default 4096
samples (`-- 64 256` for a quick test). Writes `venue.blend`, `venue_bake.npz` and
`venue_meta.json` next to the scripts (git-ignored).

```bash
python tools/venue/export_venue.py
```

Writes `assets/3d/venue.json`, `venue.bin` and `venue-floor.jpg` (the floor's light map) from the bake.

```bash
python tools/venue/validate_venue.py
```

Reads the two files back as the page does and checks them. It must end with `ALL CHECKS PASSED`.

```bash
python tools/venue/qa_venue.py
```

Looks for faces lying in each other (they would flicker) and faces turned inside out.

```bash
npm run check
```

Rebuilds the pages (the model's address carries a version taken from the two files) and runs
the site's checks.

## The files

| File | What it is |
|---|---|
| `venue_geo.py` | The geometry, in plain numpy: arches with clustered piers, lighting beams, header and towers, LED wall and side screens with bumper and hoists, stage, line arrays, moving heads, base plates, outriggers, ballast, cable looms and ramps. All sizes and the level-of-detail table are here. |
| `venue_bl.py` | Blender helpers shared by the other scripts (mesh, materials, lights, cameras, paths). |
| `bake.py` | Builds the mesh and bakes the two light attributes with Cycles. |
| `export_venue.py` | Packs the bake into `venue.json` + `venue.bin`. |
| `validate_venue.py` | Checks the exported files. |
| `qa_venue.py` | Geometry checks on the exported files. |
| `look.py` | Clay renders of the bare geometry, to judge the modelling (into `work/lab/venue2/`). |
| `previews.py` | Path-traced previews with a picture on the screens. |
| `preview_bake.py` | Renders the exported files as the page shows them (no lights, baked colour and the floor map only; into `work/lab/venue2/`). |

## Level of detail (set by distance from the camera, which looks from +z at the wall)

| Tier | Where | Chords | Lacing | Extras |
|---|---|---|---|---|
| near | arches at z 710, 850; beams and hoists beside them | 8-sided | 6-sided | conical couplers with pins at every joint, four outriggers with ballast, chain hoists, cable looms |
| mid | arches at z 430, 570 | 6-sided | 4-sided | couplers, two outriggers with ballast, wire drops |
| far | arches at z 150, 290; ridge, towers, header | 5-sided | 3-sided | none |

The whole model stays under 65,536 vertices (16-bit indices) and, with the floor map, under 2 MB.

## What the page expects (do not change without changing `js/venue.js`)

- three.js axes, Y up, 20 units to the metre. Floor at y = 0. The main LED wall stands at z = 0
  and the nave runs toward +z. The camera in `js/main.js` assumes the wall's top at y = 436 and
  its foot at y = 46.
- `venue.json`: `vertexCount`, `indexCount`, `bounds`, `sections` (byte offsets into the `.bin`),
  `wallScale`, `rigScale`, `floorMap` (`src`, `min` and `max` as (x, z), `scale`), `groups`
  (`name`, `kind`, `start`, `count`), `screens` (`name`, `min`, `max`) and `fixtures` (`pos`, `dir`).
- Group kinds, in this order: `floor`, `baked` (aluminium and steel), `coat` (black
  powder-coat: speakers, fixtures, bumper, stage, ballast, ramps), `led`, `lens` (the moving
  heads' glass), `glow` (the white edge light on the stage lip).
- `venue.bin`: positions as 16-bit numbers within `bounds`; the two light attributes as bytes
  holding a square root (light = (byte / 255) squared, times the scale); texture coordinates
  (on the screens their 0..1 picture; elsewhere wear: u = dark steel hardware, v = 1 grille,
  0.5 worn bright edge); the triangle index; the piece number of every vertex (16-bit; 0 = stays
  put), which tells the page which truss section a coupler, chain or plate flies in with.
- `venue-floor.jpg`: the wall's light on the floor, grey, square-root coded like the vertices
  (light = (value / 255) squared, times `floorMap.scale`). Row 0 is the far end (z = min), so the
  page loads it with `flipY` off.
- The LED screens' own faces are not drawn by the page: it builds each screen from `screens` as
  separate panels, so they can fly in one by one.
- A file with `"standIn": true` in its JSON is a test model; `npm run check` refuses it.
