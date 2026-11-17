"""Convert Illustrator AI8 brush-pattern PostScript art into SVG shapes.

The first unpainted rectangle ("n") of a brush pattern is the tile box (how Illustrator lays the art
out along the stroke); everything painted after it is the art.

Supported operators (AI 8 file format): m l L c C v V y Y h H, f F s S b B n N, g G k K x X Xa XA,
D (winding), XR (fill rule), u U *u *U (groups / compound paths), w (stroke width). Metadata
(/Name (string) XT etc.) is skipped.
"""
import re

NUM = re.compile(r'^-?\d*\.?\d+(?:[eE][-+]?\d+)?$')


def _gray(v):
    """Grey (0 = black) is shown by Illustrator as black ink 1 - v (0 g = #231f20, also in RGB documents)."""
    return _cmyk(0, 0, 0, 1 - float(v))


_SWOP = '/Library/Application Support/Adobe/Color/Profiles/Recommended/USWebCoatedSWOP.icc'
_xform = None
_cache = {}


def _cmyk(c, m, y, k):
    """CMYK -> sRGB as Illustrator shows it (U.S. Web Coated SWOP, perceptual: K100 = #231f20)."""
    global _xform
    key = tuple(round(float(v) * 255) for v in (c, m, y, k))
    if key in _cache: return _cache[key]
    try:
        from PIL import Image, ImageCms
        if _xform is None:
            _xform = ImageCms.buildTransform(ImageCms.getOpenProfile(_SWOP), ImageCms.createProfile('sRGB'),
                                             'CMYK', 'RGB', renderingIntent=0)
        r, g, b = ImageCms.applyTransform(Image.new('CMYK', (1, 1), key), _xform).getpixel((0, 0))
    except Exception:                                  # no profile: plain formula
        c, m, y, k = (v / 255 for v in key)
        r, g, b = (round(255 * (1 - v) * (1 - k)) for v in (c, m, y))
    _cache[key] = out = f'#{r:02x}{g:02x}{b:02x}'
    return out


def _ink(c, m, y, k):
    """How much ink a CMYK colour lays down (1 = full black), as Illustrator's tints use it."""
    c, m, y, k = map(float, (c, m, y, k))
    return 1 - (1 - k) * (1 - (0.30 * c + 0.59 * m + 0.11 * y))


def _rgb(r, g, b):
    return '#%02x%02x%02x' % tuple(round(float(v) * 255) for v in (r, g, b))


def tokenize(art):
    toks = []
    i, n = 0, len(art)
    while i < n:
        ch = art[i]
        if ch.isspace():
            i += 1
        elif ch == '(':                                   # PostScript string, may nest
            depth, j = 0, i
            while j < n:
                if art[j] == '\\': j += 2; continue
                if art[j] == '(': depth += 1
                elif art[j] == ')':
                    depth -= 1
                    if depth == 0: break
                j += 1
            toks.append(('str', art[i + 1:j])); i = j + 1
        elif ch == '[':
            j = art.find(']', i); toks.append(('arr', art[i + 1:j])); i = j + 1
        elif ch == '/':
            j = i + 1
            while j < n and not art[j].isspace() and art[j] not in '()[]/': j += 1
            toks.append(('name', art[i + 1:j])); i = j
        else:
            j = i
            while j < n and not art[j].isspace() and art[j] not in '()[]/': j += 1
            t = art[i:j]; i = j
            toks.append(('num', float(t)) if NUM.match(t) else ('op', t))
    return toks


def convert(art):
    """Returns (bounds (x0, y0, x1, y1) or None, shapes [{d, fill, stroke, width, rule}]).
    Coordinates are Illustrator's (y up)."""
    st = []
    fill, stroke, width, rule = '#000000', '#000000', 1.0, 'nonzero'
    fill_ink, stroke_ink = 1.0, 1.0     # ink coverage 0..1 for grey/CMYK colours (Illustrator tints by it), None for RGB
    cur = []          # current path data pieces
    compound = 0
    comp_d = []
    bounds = None
    shapes = []
    pt = None
    clips = []        # clip groups (q ... Q): each level's clip path data
    clip_next = [False]

    def clip_now():
        return [c for c in clips if c]

    def emit(paint_fill, paint_stroke, close):
        nonlocal cur, bounds
        d = ' '.join(cur) + (' Z' if close else '')
        cur = []
        if not d.strip(): return
        if compound:
            comp_d.append(d)
            comp_paint[0] = (paint_fill, paint_stroke)
            return
        if clip_next[0]:                                  # 'W': this path clips the rest of the group
            clip_next[0] = False
            if clips: clips[-1] = (clips[-1] + ' ' + d).strip()
            return
        if not paint_fill and not paint_stroke:
            if bounds is None:
                nums = [float(v) for v in re.findall(r'-?\d*\.?\d+', d)]
                xs, ys = nums[0::2], nums[1::2]
                bounds = (min(xs), min(ys), max(xs), max(ys))
            return
        shapes.append({'d': d, 'fill': fill if paint_fill else 'none', 'stroke': stroke if paint_stroke else 'none',
                       'width': width, 'rule': rule, 'clip': clip_now(), 'fink': fill_ink, 'sink': stroke_ink})

    comp_paint = [(True, False)]
    for kind, v in tokenize(art):
        if kind != 'op':
            st.append(v); continue
        op = v
        a = st; st = []
        nums = [x for x in a if isinstance(x, float)]
        if op == 'm' and len(nums) >= 2:
            cur.append(f'M {nums[-2]:g} {nums[-1]:g}'); pt = nums[-2:]
        elif op in ('l', 'L') and len(nums) >= 2:
            cur.append(f'L {nums[-2]:g} {nums[-1]:g}'); pt = nums[-2:]
        elif op in ('c', 'C') and len(nums) >= 6:
            x1, y1, x2, y2, x3, y3 = nums[-6:]
            cur.append(f'C {x1:g} {y1:g} {x2:g} {y2:g} {x3:g} {y3:g}'); pt = [x3, y3]
        elif op in ('v', 'V') and len(nums) >= 4 and pt:        # first control = current point
            x2, y2, x3, y3 = nums[-4:]
            cur.append(f'C {pt[0]:g} {pt[1]:g} {x2:g} {y2:g} {x3:g} {y3:g}'); pt = [x3, y3]
        elif op in ('y', 'Y') and len(nums) >= 4:               # second control = end point
            x1, y1, x3, y3 = nums[-4:]
            cur.append(f'C {x1:g} {y1:g} {x3:g} {y3:g} {x3:g} {y3:g}'); pt = [x3, y3]
        elif op in ('h', 'H'):
            cur.append('Z')
        elif op in ('f', 'F'): emit(True, False, op == 'f')
        elif op in ('s', 'S'): emit(False, True, op == 's')
        elif op in ('b', 'B'): emit(True, True, op == 'b')
        elif op in ('n', 'N'): emit(False, False, op == 'n')
        elif op == 'g' and nums: fill = _gray(nums[-1]); fill_ink = 1 - nums[-1]
        elif op == 'G' and nums: stroke = _gray(nums[-1]); stroke_ink = 1 - nums[-1]
        elif op == 'k' and len(nums) >= 4: fill = _cmyk(*nums[-4:]); fill_ink = _ink(*nums[-4:])
        elif op == 'K' and len(nums) >= 4: stroke = _cmyk(*nums[-4:]); stroke_ink = _ink(*nums[-4:])
        elif op == 'x' and len(nums) >= 4: fill = _cmyk(*nums[:4]); fill_ink = _ink(*nums[:4])
        elif op == 'X' and len(nums) >= 4: stroke = _cmyk(*nums[:4]); stroke_ink = _ink(*nums[:4])
        elif op == 'Xa' and len(nums) >= 3: fill = _rgb(*nums[-3:]); fill_ink = None
        elif op == 'XA' and len(nums) >= 3: stroke = _rgb(*nums[-3:]); stroke_ink = None
        elif op == 'XR' and nums: rule = 'evenodd' if nums[-1] == 1 else 'nonzero'
        elif op == 'D' and nums: rule = 'evenodd' if nums[-1] == 1 else 'nonzero'
        elif op == 'w' and nums: width = nums[-1]
        elif op == 'q': clips.append('')
        elif op == 'Q':
            if clips: clips.pop()
        elif op == 'W': clip_next[0] = True
        elif op == '*u':
            compound += 1; comp_d.clear(); comp_paint[0] = (True, False)
        elif op == '*U':
            compound = max(0, compound - 1)
            if comp_d:
                pf, ps = comp_paint[0]
                if clip_next[0]:
                    clip_next[0] = False
                    if clips: clips[-1] = (clips[-1] + ' ' + ' '.join(comp_d)).strip()
                elif pf or ps:
                    shapes.append({'d': ' '.join(comp_d), 'fill': fill if pf else 'none',
                                   'stroke': stroke if ps else 'none', 'width': width, 'rule': rule, 'clip': clip_now(),
                                   'fink': fill_ink, 'sink': stroke_ink})
                comp_d.clear()
        # u/U plain groups, overprint, metadata: no geometry
    return bounds, shapes


def to_svg(bounds, shapes):
    x0, y0, x1, y1 = bounds if bounds else (0, 0, 1, 1)
    body = []
    for s in shapes:
        body.append(f'<path d="{s["d"]}" fill="{s["fill"]}" stroke="{s["stroke"]}" stroke-width="{s["width"]:g}" fill-rule="{s["rule"]}"/>')
    # flip y (Illustrator is y-up) inside the tile box
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:g} {-y1:g} {x1 - x0:g} {y1 - y0:g}">'
            f'<g transform="scale(1,-1)">' + ''.join(body) + '</g></svg>')


if __name__ == '__main__':
    import sys
    sys.path.insert(0, __file__.rsplit('/', 1)[0])
    from ai8parse import parse
    b, p = parse(sys.argv[1])
    name = sys.argv[2] if len(sys.argv) > 2 else list(p)[0]
    bounds, shapes = convert(p[name])
    print(bounds, len(shapes))
    if len(sys.argv) > 3: open(sys.argv[3], 'w').write(to_svg(bounds, shapes))
