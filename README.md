# Relic Studios website

Source of https://relicstudios.xyz: the site of Relic Studios LLC and of its founder, Aidan Poole (Relic).

It is a static site served by GitHub Pages from the root of the `main` branch. Pushing to `main`
publishes it.

```bash
npm run check   # rebuild the pages and check them
npm start       # local preview at http://localhost:8001
```

Pages are built from `_src/` by `tools/build.cjs`; edit the source there, not the `.html` files in
the root. Details, hosting and design rules: [PROJECT_NOTES.md](PROJECT_NOTES.md).
