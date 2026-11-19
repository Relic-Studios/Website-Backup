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
wall only, and lit by everything else. Takes a few minutes. Writes `venue.blend`,
`venue_bake.npz` and `venue_meta.json` next to the scripts (git-ignored).

```bash
python tools/venue/export_venue.py
```

Writes `assets/3d/venue.json` and `venue.bin` from the bake.

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
| `venue_geo.py` | The geometry, in plain numpy: arches, truss, LED wall and side screens, stage, speakers, fixtures. All sizes are here. |
| `venue_bl.py` | Blender helpers shared by the other scripts (mesh, materials, lights, cameras, paths). |
| `bake.py` | Builds the mesh and bakes the two light attributes with Cycles. |
| `export_venue.py` | Packs the bake into `venue.json` + `venue.bin`. |
| `validate_venue.py` | Checks the exported files. |
| `qa_venue.py` | Geometry checks on the exported files. |
| `look.py` | Clay renders of the bare geometry, to judge the modelling. |
| `previews.py` | Path-traced previews with a picture on the screens. |
| `preview_bake.py` | Renders the exported files as the page shows them (no lights, baked colour only). |

## What the page expects (do not change without changing `js/venue.js`)

- three.js axes, Y up, 20 units to the metre. Floor at y = 0. The main LED wall stands at z = 0
  and the nave runs toward +z. The camera in `js/main.js` assumes the wall's top at y = 436 and
  its foot at y = 46.
- `venue.json`: `vertexCount`, `indexCount`, `bounds`, `sections` (byte offsets into the `.bin`),
  `wallScale`, `rigScale`, `groups` (`name`, `kind` = floor, baked, led or lens, `start`,
  `count`), `screens` (`name`, `min`, `max`) and `fixtures` (`pos`, `dir`).
- `venue.bin`: positions as 16-bit numbers within `bounds`; the two light attributes as bytes
  holding a square root (light = (byte / 255) squared, times the scale); texture coordinates;
  the triangle index.
- The LED screens' own faces are not drawn by the page: it builds each screen from `screens` as
  separate panels, so they can fly in one by one.
- A file with `"standIn": true` in its JSON is a test model; `npm run check` refuses it.
