# InkStudio for Illustrator

A Procreate-like front for Adobe Illustrator: a brush library panel and a slim rail of drawing controls, so
drawing with a pen in Illustrator feels like a drawing app. The panels only call Illustrator's own functions;
Illustrator draws every stroke, so brushes look exactly as their makers designed them.

Sister projects: [InkStudio for Photoshop](https://github.com/sampler321/inkstudio-photoshop) (raster painting) and
[PenCast](https://github.com/sampler321/pencast) (a Surface or other Windows pen tablet as a pressure tablet for the Mac).

Brushes are **not** included. InkStudio works with Illustrator's own brush libraries and with brush packs you own.

## What you get

- **InkStudio Brushes** panel: packs, favourites, recent and search across your brush libraries, with Illustrator-style
  previews; a **Media** view of ready-made drawing tools (felt pen, fineliner, brush pen, marker, bristle round, flat,
  filbert, fan and more, pencils, charcoal, pastel, watercolour, gouache) set up with size, opacity and blend mode.
- **InkStudio Rail** beside the toolbar: select, eraser, eyedropper, shape, size and opacity, colour with history,
  undo and redo.
- **Pressure opacity** for plain pens (with PenCast): each stroke fades with the pressure you drew it with.
- An **InkStudio workspace** that hides what a drawing session does not need.

See [docs/GUIDE.md](docs/GUIDE.md) for the full guide.

## Install (Mac, development)

1. Enable unsigned CEP panels: `defaults write com.adobe.CSXS.11 PlayerDebugMode 1` (and `.12`).
2. Link the folder: `ln -s "$PWD" "$HOME/Library/Application Support/Adobe/CEP/extensions/com.inkdraw.studio"`.
3. Restart Illustrator, then **Window > Extensions > InkStudio Brushes** and **InkStudio Rail**.
4. Optional workspace: `python3 tools/build_workspace.py`, then **Window > Workspace > InkStudio**.

On Windows, `tools/install-windows.ps1` copies the extension and enables unsigned panels (Illustrator closed).

## Your brush library

The Media view works with Illustrator's built-in libraries (the bristle tools use Adobe's Bristle Brush Library).
For your own packs, InkStudio indexes the .ai brush libraries once:

1. Save each brush library as Illustrator 8 text with `tools/aibrush/legacy_many.jsx` into a folder, with a
   `list.txt` of the original file paths in the same order (`INKSTUDIO_AI8`, default `~/InkStudio Brushes/ai8`).
2. Decode them: `python3 tools/aibrush/aiimport.py "<set name>" <ai8 files> --lib "~/InkStudio Brushes/lib"`
   (`INKSTUDIO_AIB` points at the resulting `aib` folder).
3. `python3 tools/build_catalog.py` writes `data/catalog.json`; `python3 tools/build_thumbs.py` renders previews.
4. Optional `data/packs.json`: per set a title, author, medium, tags and a short introduction shown in the panel.

`tools/aibrush/FORMAT.md` documents the AI8 brush format the decoder reads.

## Known Illustrator 2026 limits

- Selecting the Paintbrush by script twice crashes Illustrator 2026 inside Adobe's OnBoarding plugin, so tapping a brush
  loads and applies it and you pick the Paintbrush with **B**. Rail tools switch one at a time, at least 1.2 s apart.
- An unknown tool name passed to `app.selectTool` can also crash it; the panel only uses a verified list.
- New strokes have no scriptable default opacity: the rail stamps its opacity on strokes added since its last check
  (every 0.5 s). Set localStorage `ink.stampOff` = `1` in the rail to switch this off.

## Development

Panels expose Chrome DevTools on ports 8098 (library) and 8099 (rail) through `.debug`;
`node tools/cdp.mjs <port> eval|reload|shot`. `tools/preview.html#<set>` previews the library without Illustrator.
`tools/package.py` builds a portable package with the extension, previews and your brush files for another machine.

## License

MIT for the code. Brush libraries you add stay under their own licences; do not commit them.
