"""Small PNG previews for the InkStudio library panel: the decoded SVG parts (art, pattern side, scatter tip)
are up to 10 MB each and slow to scroll; the panel shows them ~40 px high. Renders each part with rsvg-convert
at 80 px high into data/thumbs/<part>.png and records the name in catalog.json as parts[k][2]."""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CAT = os.path.join(ROOT, 'data', 'catalog.json')
OUT = os.path.join(ROOT, 'data', 'thumbs')
H = 80

cat = json.load(open(CAT))
os.makedirs(OUT, exist_ok=True)
jobs = []
for b in cat['brushes']:
    for k in ('art', 'side', 'tip'):
        if k in b['parts']:
            jobs.append((b, k))


def render(job):
    b, k = job
    svg, aspect = b['parts'][k][0], b['parts'][k][1]
    png = svg[:-4] + '.png'
    dst = os.path.join(OUT, png)
    if not os.path.exists(dst):
        w = max(8, min(1600, round(H * float(aspect or 1))))
        r = subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(H), '-o', dst,
                            os.path.join(cat['libDir'], svg)], capture_output=True)
        if r.returncode: return f'{svg}: {r.stderr.decode()[:120]}'
    b['parts'][k] = [svg, aspect, png]
    return None


with ThreadPoolExecutor(os.cpu_count()) as ex:
    errs = [e for e in ex.map(render, jobs) if e]
json.dump(cat, open(CAT, 'w'))
size = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(f'{len(jobs) - len(errs)} thumbs, {size / 1e6:.0f} MB, {len(errs)} failed')
for e in errs[:10]: print(' ', e)
