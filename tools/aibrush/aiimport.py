"""Import Illustrator brush libraries (saved as legacy AI8 text) into InkDraw's brush library.

For every brush: its exact Illustrator definition is kept, and its artwork is written as an SVG in the
brush's own tile box (original colours kept). Writes <lib>/aib/<id>.json + <id>_<part>.svg and an
index aib/index.json. Usage: aiimport.py <set name> <ai8 file> [<ai8 file> ...] --lib <dir>
"""
import hashlib, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ai8parse import parse, ps_text
from ai8art import convert, _cmyk


def _slots(params):
    """'1 / a/ b/ / / / rest' -> (['a','b','','',''], 'rest')"""
    parts = params.split('/')
    return [s.strip() for s in parts[1:6]], '/'.join(parts[6:]).strip()


def _colour(spec):
    """Key colour before the flags: '0 1' (gray 1) or '5 r g b' (rgb)."""
    t = spec.split()
    if not t: return None
    if t[0] == '5' and len(t) >= 4: return '#%02x%02x%02x' % tuple(round(float(v) * 255) for v in t[1:4])
    if t[0] == '0' and len(t) >= 2: return _cmyk(0, 0, 0, float(t[1]))   # black ink amount (1 = black), as the art's colours
    return None


def art_svg(bounds, shapes):
    x0, y0, x1, y1 = bounds
    # clip groups: data-clip holds each enclosing clip path ('|' between levels); InkDraw intersects them
    body = ''.join(f'<path d="{s["d"]}" fill="{s["fill"]}" stroke="{s["stroke"]}" stroke-width="{s["width"]:g}" '
                   f'fill-rule="{s["rule"]}"' + (f' data-clip="{"|".join(s["clip"])}"' if s.get('clip') else '')
                   + (f' data-fink="{s["fink"]:.4g}"' if s.get('fink') is not None and s['fill'] != 'none' else '')
                   + (f' data-sink="{s["sink"]:.4g}"' if s.get('sink') is not None and s['stroke'] != 'none' else '') + '/>'
                   for s in shapes)
    # tile box in AI8 coordinates. Illustrator lays the AI8 brush art out with its y pointing down the
    # screen (checked by rendering asymmetric art), so the SVG uses the numbers as they are
    return (f'<svg xmlns="http://www.w3.org/2000/svg" data-tile="{x0:g} {y0:g} {x1:g} {y1:g}" '
            f'viewBox="{x0:g} {y0:g} {x1 - x0:g} {y1 - y0:g}"><g>{body}</g></svg>')


def import_file(path, setname, out, index, seen=None):
    brushes, pats = parse(path)
    n = 0
    for b in brushes:
        if b['name'] == 'Touch Calligraphic Brush': continue   # Illustrator's default, in every file
        if seen is not None:
            if (b['tool'], b['name']) in seen: continue      # same brush from another version of the file
            seen.add((b['tool'], b['name']))
        rec = {'set': setname, 'name': ps_text(b['name']), 'tool': b['tool'], 'params': b['params'], 'parts': {}}
        bid = hashlib.sha1((setname + '\0' + b['name'] + '\0' + b['params']).encode()).hexdigest()[:16]
        if b['tool'] in ('ArtOnPath', 'PatternOnPath'):
            slots, rest = _slots(b['params'])
            # art: slot 0 = art; pattern: side, outer corner, inner corner, end, start (checked in Illustrator)
            names = ['art'] if b['tool'] == 'ArtOnPath' else ['side', 'outer', 'inner', 'end', 'start']   # slot 4 shows at the stroke's end in Illustrator
            colour_part, _, flags = rest.partition('/')
            rec['key_colour'] = _colour(colour_part)
            rec['flags'] = [float(v) for v in flags.split()]
            for nm, pn in zip(names, slots):
                if not pn or pn not in pats: continue
                bounds, shapes = convert(pats[pn])
                if not bounds or not shapes: continue
                fn = f'{bid}_{nm}.svg'
                open(os.path.join(out, fn), 'w').write(art_svg(bounds, shapes))
                rec['parts'][nm] = {'file': fn, 'tile': bounds}
        elif b['tool'] == 'Scatter':
            m = re.match(r'\s*1\s*/(.*?)/(.*?)/(.*)$', b['params'])
            if not m: continue
            pn, colour_part, nums = m.group(1).strip(), m.group(2), m.group(3)
            rec['key_colour'] = _colour(colour_part)
            rec['flags'] = [float(v) for v in nums.split()]
            if pn in pats:
                bounds, shapes = convert(pats[pn])
                if bounds and shapes:
                    fn = f'{bid}_tip.svg'
                    open(os.path.join(out, fn), 'w').write(art_svg(bounds, shapes))
                    rec['parts']['tip'] = {'file': fn, 'tile': bounds}
        elif b['tool'] == 'Calligraphic':
            rec['flags'] = [float(v) for v in b['params'].split()]
        else:
            continue
        if b['tool'] != 'Calligraphic' and not rec['parts']: continue
        json.dump(rec, open(os.path.join(out, bid + '.json'), 'w'))
        # plain-text twin for InkDraw (no JSON parser needed there)
        with open(os.path.join(out, bid + '.aib'), 'w') as f:
            f.write(f"tool={b['tool']}\nname={ps_text(b['name'])}\nset={setname}\n")   # the name as Illustrator shows it
            f.write('flags=' + ' '.join('%g' % v for v in rec.get('flags', [])) + '\n')
            if rec.get('key_colour'): f.write(f"key={rec['key_colour']}\n")
            for nm, part in rec['parts'].items():
                f.write(f"part={nm}|{part['file']}|" + ' '.join('%g' % v for v in part['tile']) + '\n')
        index[bid] = {'set': setname, 'name': ps_text(b['name']), 'tool': b['tool']}
        n += 1
    return n


if __name__ == '__main__':
    args = sys.argv[1:]
    lib = args[args.index('--lib') + 1]; args = args[:args.index('--lib')]
    setname, files = args[0], args[1:]
    out = os.path.join(lib, 'aib'); os.makedirs(out, exist_ok=True)
    ip = os.path.join(out, 'index.json')
    index = json.load(open(ip)) if os.path.exists(ip) else {}
    total = sum(import_file(f, setname, out, index) for f in files)
    json.dump(index, open(ip, 'w'), indent=0)
    print(setname, total)
