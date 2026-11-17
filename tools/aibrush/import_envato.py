"""Import every converted Envato Illustrator pack (ai8/<i>.ai, list.txt maps i -> source) into one library.
One set per pack; versions of the same file (CS/CC, HD/low) are deduplicated by brush name, best first.
Usage: import_envato.py <ai8 dir> <lib dir>"""
import os, re, sys, json
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aiimport import import_file

SKIP_WORDS = ['for adobe illustrator', 'for illustrator', 'adobe illustrator', 'illustrator', 'vector', 'brushes', 'brush', 'kit', 'set', 'pack', 'collection']

RENAME = {"Carpenter S Pencil": "Carpenter's Pencil", "Fineliner Type Decorator S Tool": "Fineliner Type Decorator",
          "Charcoals For Adobe Illustator": "Charcoals", "Watercolor 2 2": "Watercolor 3", "Subtlecraft Textures And": "Subtlecraft Textures",
          "Of Watercolor And Textures": "Watercolor And Textures", "Ihd Pencil Vintage": "IHD Pencil Vintage"}


def set_name(folder):
    n = _set_name(folder)
    n = RENAME.get(n, n)
    return re.sub(r'\bProbrush\b', 'ProBrush', n)


def _set_name(folder):
    n = folder.replace('-', ' ').strip()
    low = n.lower()
    for w in SKIP_WORDS:
        low2 = re.sub(r'\b' + re.escape(w) + r'\b', ' ', low)
        if low2.strip(): low = low2
    words = [w for w in low.split() if w]
    return ' '.join(w.upper() if len(w) <= 2 and w.isalpha() and w in ('ai',) else w.capitalize() for w in words) or folder

def score(path):
    b = os.path.basename(path).lower(); s = 0
    if 'hd' in b or 'high' in b: s += 2
    if 'cc' in b: s += 1
    if 'low' in b: s -= 2
    if 'cs' in b: s -= 1
    return -s

def run(job):
    setname, files, out = job
    seen, index, n = set(), {}, 0
    for f in sorted(files, key=score):
        try: n += import_file(f, setname, out, index, seen)
        except Exception as e: print('ERR', f, e, flush=True)
    return setname, n, index

if __name__ == '__main__':
    ai8, lib = sys.argv[1:3]
    out = os.path.join(lib, 'aib'); os.makedirs(out, exist_ok=True)
    src = open(os.path.join(ai8, 'list.txt')).read().split('\n')
    packs = {}
    for i, p in enumerate(src):
        f = os.path.join(ai8, f'{i}.ai')
        if not p or not os.path.exists(f): continue
        if os.path.getsize(f) > 800e6: print('skip (too big)', p); continue
        folder = p.split('/packs/')[1].split('/')[0]
        packs.setdefault(folder, []).append(f)
    names = {}
    jobs = []
    for folder, files in packs.items():
        nm = _set_name(folder)
        while nm in names.values(): nm += ' 2'
        nm = RENAME.get(nm, nm); nm = re.sub(r'\bProbrush\b', 'ProBrush', nm)
        names[folder] = nm
        jobs.append((nm, files, out))
    index = {}
    with Pool(6) as pool:
        for setname, n, idx in pool.imap_unordered(run, jobs):
            print(f'{n:5d}  {setname}', flush=True); index.update(idx)
    json.dump(index, open(os.path.join(out, 'index.json'), 'w'), indent=0)
    print('total', len(index))
