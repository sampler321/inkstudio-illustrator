# Illustrator brush definitions (legacy AI8 text save)

How to get them: open the brush library .ai in Illustrator, save as Illustrator 8, uncompressed, no PDF
(tools/aibrush/legacy_many.jsx). Records are separated by \r; `ai8parse.py` normalises and extracts:

    %AI8_BeginPluginObject(Adobe <Tool> Brush Tool)(<name>)(<params>) .%AI8_EndPluginObject
    %AI8_BeginBrushPattern(<pattern name>)<PostScript art>%AI8_EndBrushPattern

Tools: Calligraphic, Scatter, ArtOnPath (art), PatternOnPath (pattern).

## Decoded parameter layouts (checked by forging definitions and rendering them in Illustrator 2026)

Geometry: Illustrator lays AI8 brush art out with the data's y pointing DOWN the screen. For a stroke
drawn left to right, the tile's larger-y edge is on the right of travel (screen bottom). Use the numbers
as they are, no y flip.

- ArtOnPath: `1 / <art>/ / / / / <key colour> /  f0..f7`
  f1 colorization (0 none, 1 tints, 2 tints and shades, 3 hue shift); f2 width (1 = 100%);
  f5 flip along; f6 flip across; f7 scale proportionately (thickness follows length).
  f0, f3, f4: no geometric effect with a mouse path (likely pressure/width-variation settings).
- PatternOnPath: `1 / side/ outer/ inner/ start/ end/ <key colour> /  f0..f7`
  f1 colorization, f2 scale, f3 spacing (x side tile width; a gap before every tile and after the
  last), f4 fit (2 add space: floor tiles, gaps grow; 0/1 stretch: round tiles, tiles and gaps scale),
  f5 flip along (whole path reversed), f6 flip across.
- Scatter: `1 /<tip>/ <key colour> / f0 | size min max mode | spacing min max mode |
  scatter min max mode | rotation min max mode | f13 | f14`
  f0 colorization. Size scales the copies only; spacing and scatter are fractions of the tip tile WIDTH
  at 100% (independent of size). Positive scatter = left of travel. First copy centred on the path
  start. Rotation positive = counter-clockwise. f13 = 1 rotation relative to path (tile +x along the
  tangent), 0 page. Stroke weight does not scale scatter copies. Mode 0 fixed, 1 random.
- Calligraphic: `1 size sizeVar roundness roundnessVar angle angleVar ...` (to verify)
- Key colour: `0 g` grey (1 = black ink) or `5 r g b`.

## Pattern brush corners (measured with colour-coded forged tiles, Illustrator 2026)

At a corner anchor, the outer corner tile is used where the path turns left on screen, the inner tile
where it turns right. With h = side tile height (scaled) and turn angle T, each side run stops
r = (h/2) * tan(T/2) before the corner (exactly h/2 at 90 degrees). The corner tile fills the
quadrilateral bounded by both bands' end caps and their outer edges, mapped bilinearly:
tile (0,0) -> outer miter, (1,0) -> outgoing cap outer corner, (1,1) -> inner miter,
(0,1) -> incoming cap outer corner (tile x along its length, AI8 y as stored). Smooth anchors get no
corner tile; InkDraw applies corners to QuickShape shapes only.

Stroke weight scales art, pattern and scatter brushes uniformly (set it after applyTo in scripts:
applyTo resets it). Tints use the art's ink amount (grey/CMYK) or luma 0.30R+0.59G+0.11B (RGB);
hue shift moves hue by (stroke - key) and maps saturation/brightness with a levels curve through
(key -> stroke) that keeps 0 and 1.
