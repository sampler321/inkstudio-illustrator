"""Self-contained InkStudio package for another machine (the Surface): the extension, small PNG previews, the
original Envato .ai files the brushes load from, and a catalog whose paths are relative to the extension.

    python3 tools/package.py [out_dir]      (default ~/inkstudio-illustrator-dist)

Writes <out>/com.inkdraw.studio/ plus install-windows.ps1 and install-mac.sh next to it. Brush files are
hard-linked when possible, so the package costs little extra disk space on this Mac."""
import json, os, re, shutil, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.abspath(os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else '~/inkstudio-illustrator-dist'))
EXT = os.path.join(OUT, 'com.inkdraw.studio')

cat = json.load(open(os.path.join(ROOT, 'data', 'catalog.json')))
thumbs = os.path.join(ROOT, 'data', 'thumbs')
if not os.path.isdir(thumbs): sys.exit('run tools/build_thumbs.py first')

if os.path.exists(EXT): shutil.rmtree(EXT)
for d in ('CSXS', 'js', 'jsx', 'library', 'rail'):
    shutil.copytree(os.path.join(ROOT, d), os.path.join(EXT, d))
shutil.copytree(thumbs, os.path.join(EXT, 'data', 'thumbs'))
for f in ('media.json', 'paper-grain.png'):
    shutil.copy2(os.path.join(ROOT, 'data', f), os.path.join(EXT, 'data', f))


def safe(s):
    return re.sub(r'[^A-Za-z0-9._ -]+', '_', s).strip()[:80]


# brushes/<set>/<file>.ai, one folder per set; same file shared by several brushes is copied once
dest, used = {}, set()
for b in cat['brushes']:
    src = b['file']
    if src not in dest:
        rel = 'brushes/' + safe(b['set']) + '/' + safe(os.path.basename(src))
        base, n = rel[:-3], 2
        while rel in used: rel = f'{base} {n}.ai'; n += 1
        used.add(rel); dest[src] = rel
        to = os.path.join(EXT, rel)
        os.makedirs(os.path.dirname(to), exist_ok=True)
        try: os.link(src, to)
        except OSError: shutil.copy2(src, to)
    b['file'] = dest[src]
    for k in list(b['parts']):                      # only the PNG previews travel
        if len(b['parts'][k]) < 3: del b['parts'][k]
cat['brushDir'] = 'brushes'
cat.pop('libDir', None)
json.dump(cat, open(os.path.join(EXT, 'data', 'catalog.json'), 'w'))

shutil.copy2(os.path.join(ROOT, 'workspace', 'InkStudio'), os.path.join(OUT, 'InkStudio.workspace'))
for f in ('install-windows.ps1', 'install-mac.sh', 'install-portable.ps1'):
    shutil.copy2(os.path.join(ROOT, 'tools', f), os.path.join(OUT, f))

size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(EXT) for f in fs)
print(f'{EXT}: {len(cat["brushes"])} brushes, {len(dest)} brush files, {size / 1e9:.2f} GB')
