"""Catalog of your Illustrator brush libraries for the InkStudio panel: for every brush in the decoded library
($INKSTUDIO_AIB, made by tools/aibrush/aiimport.py), its set, name as Illustrator shows it, kind, preview parts and the
ORIGINAL Envato .ai file Illustrator loads it from (same pack and best-version order as the import).
Writes data/catalog.json."""
import hashlib, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'aibrush'))
from ai8parse import parse, ps_text
from import_envato import _set_name, RENAME, score
import re

AI8 = os.path.expanduser(os.environ.get('INKSTUDIO_AI8', '~/InkStudio Brushes/ai8'))     # AI8 copies + list.txt (original paths)
LIB = os.path.expanduser(os.environ.get('INKSTUDIO_AIB', '~/InkStudio Brushes/lib/aib'))  # decoded library
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'catalog.json')

src = open(os.path.join(AI8, 'list.txt')).read().split('\n')
packs = {}
for i, p in enumerate(src):
    f = os.path.join(AI8, f'{i}.ai')
    if '/packs/' not in p or not os.path.exists(f) or os.path.getsize(f) > 800e6: continue
    packs.setdefault(p.split('/packs/')[1].split('/')[0], []).append((f, p))
names = {}
for folder in packs:                       # same order and rules as import_envato.py
    nm = _set_name(folder)
    while nm in names.values(): nm += ' 2'
    names[folder] = nm
for folder in names:
    nm = RENAME.get(names[folder], names[folder]); names[folder] = re.sub(r'\bProbrush\b', 'ProBrush', nm)

brushes = {}
for folder, files in packs.items():
    setname = names[folder]; seen = set()
    for f, orig in sorted(files, key=lambda x: score(x[0])):
        try: bs, _ = parse(f)
        except Exception: continue
        for b in bs:
            if b['name'] == 'Touch Calligraphic Brush' or (b['tool'], b['name']) in seen: continue
            seen.add((b['tool'], b['name']))
            bid = hashlib.sha1((setname + '\0' + b['name'] + '\0' + b['params']).encode()).hexdigest()[:16]
            if not os.path.exists(os.path.join(LIB, bid + '.aib')): continue
            parts = {}
            for line in open(os.path.join(LIB, bid + '.aib'), encoding='utf-8'):
                if line.startswith('part='):
                    nm, fn, tile = line.strip()[5:].split('|')
                    x0, y0, x1, y1 = map(float, tile.split())
                    parts[nm] = [fn, round((x1 - x0) / max(1e-6, y1 - y0), 4)]   # file, width/height
            brushes[bid] = {'id': bid, 'set': setname, 'name': ps_text(b['name']), 'tool': b['tool'],
                            'file': orig, 'parts': parts}
    print(f'{setname}: {sum(1 for v in brushes.values() if v["set"] == setname)}', flush=True)
sets = sorted({b['set'] for b in brushes.values()}, key=lambda s: s.lower())
json.dump({'libDir': LIB, 'sets': sets, 'brushes': sorted(brushes.values(), key=lambda b: (b['set'].lower(), b['name']))},
          open(OUT, 'w'), ensure_ascii=False)
print('total', len(brushes))
