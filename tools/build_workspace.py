"""Writes the "InkStudio" Illustrator workspace: Procreate-like, everything else closed but still in Window.

Left: Illustrator's Basic toolbar. Right: a narrow InkStudio Rail column (size, opacity, undo/redo, colour),
then InkStudio Brushes on top, Color/Swatches and Layers/Brushes below. Control bar closed.
Built from Illustrator's own Essentials preset: its closed floating panels are kept (renumbered) so every
other panel still opens from the Window menu, only the docks change.

    python3 tools/build_workspace.py [--install]

Writes workspace/InkStudio in the repo; --install also copies it to Illustrator's user Workspaces folder
(Window > Workspace > InkStudio)."""
import glob, os, re, shutil, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PRESETS = glob.glob('/Applications/Adobe Illustrator 20*/Presets.localized/en_US/Workspaces/Essentials')
USER = glob.glob(os.path.expanduser('~/Library/Preferences/Adobe Illustrator * Settings/en_US'))

LIB = 'CSXSExtension_com.inkdraw.studio.library_0'
RAIL = 'CSXSExtension_com.inkdraw.studio.rail_0'
OURS = {LIB, RAIL, 'Color', 'AdobeSwatch_', 'AdobeLayerPalette', 'AdobeBrush', 'ControlBar', 'Basic', 'ToolBar'}


def hexblock(s):
    h = s.encode().hex()
    return '\r\t\t\t'.join(h[i:i + 64] for i in range(0, len(h), 64))


def palette(pid, app, w, h, active=True):
    return (f'\t\t\t\t<palette id="{pid}" is-closed="false" preferred-unconstrained-size="{w} {h}" '
            f'preferred-constrained-size="{w} {h}" current-state="1" is-minimized="false" app-data="{app}" '
            f'host-cached-sizes="false"/>\n')


def group(pids_apps):
    first = pids_apps[0][0]
    return (f'\t\t\t<tab-group active-palette="{first}" is-closed="false">\n'
            + ''.join(palette(p, a, w, h) for p, a, w, h in pids_apps) + '\t\t\t</tab-group>\n')


def build(preset_text):
    m = re.search(r'/OWLBookMark \[ (\d+)\s+([0-9a-f\s]+?)\s*\]', preset_text)
    layout = bytes.fromhex(re.sub(r'\s', '', m.group(2))).decode()
    # closed floating docks of every other panel, minus the ones we place
    floating = [d for d in re.findall(r'\t<dock anchor="none".*?</dock>\n', layout, re.S)
                if not (set(re.findall(r'app-data="([^"]*)"', d)) & OURS)]
    nid = [20]

    def renum(d):
        old = re.findall(r'<palette id="(\d+)"', d)
        new = {}
        for o in old:
            nid[0] += 1; new[o] = str(nid[0])
        d = re.sub(r'<palette id="(\d+)"', lambda mm: f'<palette id="{new[mm.group(1)]}"', d)
        return re.sub(r'active-palette="(\d+)"', lambda mm: f'active-palette="{new.get(mm.group(1), mm.group(1))}"', d)

    floating = [renum(d) for d in floating]
    xml = ('<workspace version="1">\n'
           '\t<dock anchor="top" content="control-bar" is-closed="false">\n'
           '\t\t<control-bar id="1" origin="11 40" size="1008 31" is-closed="true" app-data="ControlBar"/>\n'
           '\t</dock>\n'
           '\t<dock anchor="bottom" content="control-bar" is-closed="false"/>\n'
           '\t<dock anchor="left" content="palette toolbar" is-closed="false">\n'
           '\t\t<toolbar id="2" size-variant="vertical-narrow" is-closed="false" app-data="Basic"/>\n'
           '\t\t<toolbar id="3" size-variant="vertical-wide" is-closed="true" app-data="ToolBar"/>\n'
           '\t</dock>\n'
           '\t<dock anchor="right" content="palette toolbar" is-closed="false">\n'
           # a left-docked panel pane stays blank in Illustrator 2026, so the rail is its own narrow column
           # on the canvas side of the right dock
           '\t\t<tab-pane mode="expanded" preferred-iconic-length="0" layout-mode="auto-flow">\n'
           + group([(4, RAIL, 120, 900)]) +
           '\t\t</tab-pane>\n'
           '\t\t<tab-pane mode="expanded" preferred-iconic-length="0" layout-mode="auto-flow">\n'
           + group([(5, LIB, 320, 560)])
           + group([(6, 'Color', 320, 180), (7, 'AdobeSwatch_', 320, 180)])
           + group([(8, 'AdobeLayerPalette', 320, 200), (9, 'AdobeBrush', 320, 200)]) +
           '\t\t</tab-pane>\n'
           '\t</dock>\n'
           + ''.join(floating) + '</workspace>\n')
    name = 'InkStudio'
    out = re.sub(r'/collectionName \[ \d+\s+[0-9a-f\s]+?\s*\]',
                 lambda mm: f'/collectionName [ {len(name)}\r\t\t\t{name.encode().hex()}\r\t\t]', preset_text, 1)
    out = out.replace(m.group(0), f'/OWLBookMark [ {len(xml.encode())}\r\t\t\t{hexblock(xml)}\r\t\t]')
    return out, xml


if __name__ == '__main__':
    if not PRESETS: sys.exit('Illustrator Essentials workspace preset not found')
    text, xml = build(open(PRESETS[0], newline='').read())
    os.makedirs(os.path.join(ROOT, 'workspace'), exist_ok=True)
    open(os.path.join(ROOT, 'workspace', 'InkStudio'), 'w', newline='').write(text)
    open(os.path.join(ROOT, 'workspace', 'InkStudio.layout.xml'), 'w').write(xml)
    print('workspace/InkStudio written', len(text), 'bytes')
    if '--install' in sys.argv:
        for u in USER:
            os.makedirs(os.path.join(u, 'Workspaces'), exist_ok=True)
            shutil.copy2(os.path.join(ROOT, 'workspace', 'InkStudio'), os.path.join(u, 'Workspaces', 'InkStudio'))
            print('installed to', os.path.join(u, 'Workspaces'))
