# InkStudio for Illustrator: guide

InkStudio turns Illustrator into a pen-first drawing app. Everything you draw is ordinary Illustrator artwork:
vector paths with Illustrator brushes, editable afterwards with any Illustrator tool.

## Workspace

Choose **Window > Workspace > InkStudio**. The rail sits next to Illustrator's toolbar, the brush library on the
right. Everything else in Illustrator is still in its menus and panels.

## Rail

| Control | Use |
|---|---|
| Eraser | Erase parts of paths. |
| Shape | Shaper tool: scribble a rough shape, Illustrator turns it into a clean one. |
| Select (V) | Select and move strokes. |
| Eyedropper (I) | Pick a colour and style from the artwork. |
| Size | Stroke weight of the current and the next strokes. |
| Opacity | Opacity of the next strokes (stamped on each new stroke). |
| Colour | Current stroke colour; the swatches below are your recent colours. |
| Undo, Redo | One step back or forward. |

Illustrator's Paintbrush is the drawing tool: press **B**. InkStudio does not select it by script because that
crashes Illustrator 2026 (see the README).

## Brush library

The left column offers **Media**, **Favourites**, **Recent** and **All packs**, then your brushes grouped by **Mediums**, **Makers** and **Packs**; tap a pack to open it and a brush to load it. Loading applies
the brush to the Paintbrush and to any selected strokes. **Favourites** keeps starred brushes, **Recent** the ones
you used last. Search matches pack names, makers, tags and brush names.

Brush kinds, as Illustrator defines them:

| Kind | What it does |
|---|---|
| Art brush (ArtOnPath) | Stretches one piece of artwork along the stroke: ink swipes, pencil lines, paint strokes. |
| Pattern brush (PatternOnPath) | Repeats tiles along the stroke: borders, chains, stitches. |
| Scatter brush | Scatters copies of artwork along the stroke: leaves, dots, splatter. |
| Bristle brush | Simulated bristles with transparency, Illustrator's painterly brush. |
| Calligraphic brush | An elliptical nib whose width follows angle and pressure. |

## Media

**Media** offers ready-made drawing tools grouped as:

- **Pressure**: plain pens with a pressure width profile (felt pen, marker, wash). They work without any pack and
  can fade with pressure (below).
- **Live with pressure** (draw with the Paintbrush, B): pressure-sensitive pens and Adobe's bristle brushes in real brush shapes: round, liner, spotter, filbert,
  flat, bright, angle, fan, cat's tongue, dagger, mop, dome, deerfoot and stippler.
- **Textured** (draw with the Pencil, N): pencils, coloured pencil, fineliner, brush pen, dry ink, marker, watercolour, gouache, charcoal, soft
  pastel and oil pastel. These use art brushes from specific packs; a tool whose pack is not installed shows
  "Could not load".

Each tool sets brush, size, opacity and blend mode together; Multiply makes overlapping strokes darken like ink and
marker.

## Pressure

Illustrator reads pen pressure for brush width (Paintbrush options and the brush's own pressure settings). For
opacity it has no pressure option, so InkStudio adds one for the plain Pressure pens: with
[PenCast](https://github.com/sampler321/pencast) running, the relay sends the pressure along each stroke when you lift
the pen and InkStudio turns it into an opacity gradient on that stroke. Light, Hard and Curve set the faintest and
strongest opacity and how quickly it builds.

## Tips

- Draw fast with **Paintbrush** fidelity towards Smooth (double-click the Paintbrush) for clean curves.
- Keep **Keep Selected** off in Paintbrush options, otherwise the next stroke may replace the last.
- Use layers for sketch, line and colour, as you would on paper.
- Expand brushed strokes (Object > Expand Appearance) only when you need to edit the brush artwork itself.
