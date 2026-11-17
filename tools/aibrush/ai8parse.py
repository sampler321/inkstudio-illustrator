"""Parse brush definitions from an Illustrator file saved in the legacy AI8 text format.
Prints/returns: brushes (tool, name, raw params) and brush patterns (name -> raw PostScript art)."""
import re, sys, json

def ps_text(raw):
    """A PostScript string's text as Illustrator shows it: escapes undone (\\( \\) \\\\ \\ddd \\n ...), high bytes in
    the creator's code page (Windows-1251 when they read as Cyrillic, otherwise Windows-1252)."""
    out = bytearray(); i = 0
    while i < len(raw):
        c = raw[i]
        if c == '\\' and i + 1 < len(raw):
            n = raw[i + 1]
            if n in '01234567':
                j = i + 1
                while j < len(raw) and j < i + 4 and raw[j] in '01234567': j += 1
                out.append(int(raw[i + 1:j], 8) & 255); i = j; continue
            out += {'n': b'\n', 'r': b'\r', 't': b'\t', 'b': b'\b', 'f': b'\f'}.get(n, n.encode('latin-1')); i += 2; continue
        out += c.encode('latin-1'); i += 1
    letters = [b for b in out if b >= 0xC0 or chr(b).isalpha()]
    high = [b for b in letters if b >= 0xC0]
    if high and len(high) * 2 > len(letters):          # mostly non-Latin letters: a Cyrillic name
        try: return out.decode('cp1251')
        except UnicodeDecodeError: pass
    try: return out.decode('cp1252')
    except UnicodeDecodeError: return out.decode('latin-1')


def parse(path):
    raw = open(path, 'rb').read().decode('latin-1')
    # records are '%'-separated inside long lines; normalise
    text = raw.replace('\r', '').replace('\n', '')
    brushes = []
    for m in re.finditer(r'%AI8_BeginPluginObject\(Adobe ([A-Za-z ]+?) Brush Tool\)\((.*?)\)\((.*?)\) \.%AI8_EndPluginObject', text, re.S):
        tool, name, params = m.group(1), m.group(2), m.group(3)
        params = re.sub(r'\)\s*-\s*\(', '', params)   # continued strings
        brushes.append({'tool': tool, 'name': name, 'params': params})
    pats = {}
    ptext = raw.replace('\r', '\n')   # pattern art: keep token separators
    for m in re.finditer(r'%AI8_BeginBrushPattern\n\((.*?)\)\n(.*?)%AI8_EndBrushPattern', ptext, re.S):
        pats[m.group(1)] = m.group(2)
    return brushes, pats

if __name__ == '__main__':
    b, p = parse(sys.argv[1])
    for x in b:
        print(f"{x['tool']:<22} {x['name'][:30]:<30} {x['params'][:150]}")
    print(len(b), 'brushes', len(p), 'patterns')
