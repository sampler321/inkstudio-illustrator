// InkStudio host side: only Illustrator's own functions. Called from the panels with evalScript.
#target illustrator

function _find(doc, n) { for (var i = 0; i < doc.brushes.length; i++) if (doc.brushes[i].name == n) return doc.brushes[i]; return null; }
/** doc.selection = null throws "Target layer cannot be modified" when the document has locked layers */
function _deselect(d) { try { d.selection = null; } catch (e) { try { app.activeDocument = d; app.executeMenuCommand("deselectall"); } catch (e2) {} } }
/** The Paintbrush draws with Illustrator's *current style*, which follows the last selected object.
    So: a throwaway stroke with brush + width + opacity + blend, selected for a moment, then removed. */
function _rgb(hex) { var c = new RGBColor(); c.red = parseInt(hex.substr(1, 2), 16); c.green = parseInt(hex.substr(3, 2), 16); c.blue = parseInt(hex.substr(5, 2), 16); return c; }
function _setStyle(d, brName, w, op, blend) {
    var br = brName ? _find(d, brName) : null, L = d.activeLayer;
    if (L.locked || !L.visible) for (var i = 0; i < d.layers.length; i++) if (!d.layers[i].locked && d.layers[i].visible) { L = d.layers[i]; break; }
    var t = L.pathItems.add(); t.setEntirePath([[0, 0], [50, 0]]); t.filled = false; t.stroked = true;
    if (br) br.applyTo(t);
    t.strokeWidth = w; if (op != null) t.opacity = Number(op);
    var hex = _pref("inkColor", ""); if (hex) t.strokeColor = _rgb(hex);
    if (blend) t.blendingMode = blend == "multiply" ? BlendModes.MULTIPLY : BlendModes.NORMAL;
    _deselect(d); t.selected = true; app.redraw(); t.remove();
}
/** Illustrator ignores defaultStrokeWidth unless the default style is stroked (and unfilled, for brushes) */
function _setWidth(d, w) { _setPref("inkSize", w); try { d.defaultStroked = true; d.defaultFilled = false; d.defaultStrokeWidth = w; } catch (e) {} }
// Pencil "Live preview" renders brushes while drawing only when new art keeps the current appearance
// and no selection marks after a stroke: Pencil/Paintbrush don't keep or edit the stroke, no bounding box
(function () { var P = app.preferences, want = { "AI New Art Basic Appearance": 0, "Adobe Freehand Tool/select": 0, "Adobe Freehand Tool/edit_selection": 0,
    "Adobe Paintbrush Tool/select": 0, "Adobe Paintbrush Tool/edit_selection": 0, "showBoundingBox": 0 };
  for (var k in want) try { if (P.getIntegerPreference(k) != want[k]) P.setIntegerPreference(k, want[k]); } catch (e) {} })();
function _doc() { if (!app.documents.length) app.documents.add(DocumentColorSpace.RGB, 2732, 2048); return app.activeDocument; }

/** Make brush `bname` from library file `lib` the current brush (Paintbrush), applying it to the selection
 * as Illustrator does when a brush is picked. Imports it into the document the first time. */
/** "adobe:<path>" = a library from Illustrator's own Presets (Mac: Presets.localized, Windows: Presets), in the app's locale */
function _lib(lib) {
    if (lib.indexOf("adobe:") != 0) return lib;
    var rest = lib.substr(6), roots = [app.path + "/Presets.localized/" + app.locale, app.path + "/Presets/" + app.locale, app.path + "/Presets.localized/en_US", app.path + "/Presets/en_US"];
    for (var i = 0; i < roots.length; i++) { var f = File(roots[i] + "/Brushes/" + rest); if (f.exists) return f.fsName; }
    return lib;
}
function inkUseBrush(lib, bname) {
    lib = _lib(lib);
    var old = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    try {
        var target = _doc();
        var sel = [];
        for (var s = 0; s < target.selection.length; s++) sel.push(target.selection[s]);
        if (!_find(target, bname)) {
            var src = app.open(new File(lib));
            try {
                var b = _find(src, bname);
                if (!b) return "error: brush not in library";
                // a fresh layer: library files often open on a template or locked layer
                var p = src.layers.add().pathItems.add(); p.setEntirePath([[0, 0], [100, 0]]); p.stroked = true; p.filled = false;
                b.applyTo(p); _deselect(src); p.selected = true; app.copy();
            } finally { src.close(SaveOptions.DONOTSAVECHANGES); }
            app.activeDocument = target;
            // with "Paste Remembers Layers" on, every paste would leave an empty layer behind
            var remember = false; try { remember = app.preferences.getBooleanPreference("layers/pasteRemembers"); app.preferences.setBooleanPreference("layers/pasteRemembers", false); } catch (e) {}
            try { _deselect(target); app.paste(); }
            finally { try { app.preferences.setBooleanPreference("layers/pasteRemembers", remember); } catch (e) {} }
            var pasted = target.selection; for (var i = pasted.length - 1; i >= 0; i--) pasted[i].remove();
        }
        var br = _find(target, bname);
        sel = []; _deselect(target);   // Procreate-like: a picked brush is for the next stroke, existing strokes stay
        if (!_inkNoStyle) {
            // a plain brush from a set: about 6 pt wide on paper, full opacity, normal blend
            var w = 1;
            try { var t = target.layers.add().pathItems.add(); t.setEntirePath([[0, 0], [200, 0]]); t.stroked = true; t.filled = false; t.strokeWidth = 1;
                  br.applyTo(t); var vb = t.visibleBounds, h = vb[1] - vb[3]; t.layer.remove(); if (h > 0.01) { w = Math.max(0.01, Math.min(50, 6 / h)); _setPref("inkBrushH", h); } } catch (e) {}
            _setPref("inkOp", 100); _setPref("inkBlend", "normal"); _setWidth(target, w);
            try { _setStyle(target, bname, w, 100, "normal"); } catch (e) {}
        }
        _deselect(target);
        for (var k2 = 0; k2 < sel.length; k2++) try { sel[k2].selected = true; } catch (e) {}
        _setPref("inkBrush", bname);
        // no scripted switch to the Paintbrush: re-selecting it by script crashes Illustrator 2026 (OnBoarding plugin)
        return "ok";
    } catch (e) { return "error: " + e; }
    finally { app.userInteractionLevel = old; }
}

/** Brush size = stroke weight of new strokes and of the selection. */
function inkSetSize(w) {
    var d = _doc(); w = Number(w);
    _setWidth(d, w);
    _deselect(d);
    try { _setStyle(d, _pref("inkBrush", ""), w, _pref("inkOp", 100), _pref("inkBlend", "normal")); } catch (e) {}
    return "ok";
}

function inkSetOpacity(o) {
    var d = _doc(); o = Number(o); _setPref("inkOp", o);
    _deselect(d); try { _setStyle(d, _pref("inkBrush", ""), d.defaultStrokeWidth, o, _pref("inkBlend", "normal")); } catch (e) {}
    return "ok";
}

/** Colour of new strokes and of the selection (hex like "#1e1e1e"). */
function inkSetColor(hex) {
    var d = _doc(), c = _rgb(hex); _setPref("inkColor", hex);
    try { d.defaultStrokeColor = c; } catch (e) {}
    _deselect(d);
    try { _setStyle(d, _pref("inkBrush", ""), d.defaultStrokeWidth, _pref("inkOp", 100), _pref("inkBlend", "normal")); } catch (e) {}
    return "ok";
}

// kept across re-evaluations of this file (the panels reload it per action): no initialisers
var _inkStack; if (!_inkStack) _inkStack = [];
function inkUndo() {
    // undo whole strokes: settings changes (size, opacity, colour, brush) leave invisible undo steps, skip them
    try {
        var d = app.activeDocument, key = d.fullName ? String(d.fullName) : d.name, n0 = d.pageItems.length;
        for (var i = 0; i < 40; i++) { app.undo(); if (d.pageItems.length < n0) break; }
        // the stroke's own opacity step can sit just below it: if the next step only restyles, leave it (harmless)
        // undoing also rolled back the brush settings: put the current ones back
        var w = Number(_pref("inkSize", d.defaultStrokeWidth));
        _deselect(d); try { _setWidth(d, w); _setStyle(d, _pref("inkBrush", ""), w, _pref("inkOp", 100), _pref("inkBlend", "normal")); } catch (e) {}
        _inkSeen[key] = d.pageItems.length;
        return "ok";
    } catch (e) { return "error: " + e; }
}
function inkRedo() { try { app.redo(); return "ok"; } catch (e) { return "error: " + e; } }
// Only these names are safe: app.selectTool with an unknown name has crashed Illustrator 2026.
var _inkTools = { "Adobe Eraser Tool": 1, "Adobe Shaper Tool": 1, "Adobe Select Tool": 1,
    "Adobe Direct Select Tool": 1, "Adobe Eyedropper Tool": 1, "Adobe Hand Tool": 1, "Adobe Zoom Tool": 1,
    "Adobe Rotate View Tool": 1 };
// Rapid tool switches crash Illustrator 2026 in Adobe's OnBoarding plugin: skip repeats, keep >= 1.2 s between switches.
var _inkCur = "", _inkAt = 0;
function _inkSelect(t) {
    if (t === _inkCur && new Date().getTime() - _inkAt < 5000) return "ok";   // the user may switch tools by hand
    var wait = _inkAt + 1200 - new Date().getTime();
    if (wait > 0) $.sleep(wait);
    try {
        app.selectTool(t); _inkCur = t; _inkAt = new Date().getTime(); return "ok";
    } catch (e) { return "error: " + e; }
}
function inkTool(t) { if (!_inkTools[t]) return "error: unknown tool"; return _inkSelect(t); }

/** State for the panels: size and colour of new strokes. */
function inkState() {
    if (!app.documents.length) return "{}";
    var d = app.activeDocument, c = d.defaultStrokeColor, hex = "";
    try {
        if (c.typename == "RGBColor") {   // ExtendScript has no Array.map
            var v = [c.red, c.green, c.blue]; hex = "#";
            for (var i = 0; i < 3; i++) { var s = Math.round(v[i]).toString(16); hex += s.length < 2 ? "0" + s : s; }
        }
    } catch (e) {}
    var z = 1; try { z = d.activeView.zoom; } catch (e) {}
    return '{"size":' + d.defaultStrokeWidth + ',"color":"' + hex + '","selected":' + d.selection.length + ',"zoom":' + z + ',"bh":' + Number(_pref("inkBrushH", 1)) + '}';
}

/** Opacity for new strokes (Illustrator has no scripting default for it): strokes added since the last
 * call get the rail's opacity. Called on a short timer by the rail; cheap when nothing changed. */
var _inkSeen; if (!_inkSeen) _inkSeen = {};
function inkStampNew(o) {
    // the current medium's look (opacity, blend) is kept in Illustrator's preferences so both panels share it
    var op = _pref("inkOp", o), blend = _pref("inkBlend", "normal");
    if (!app.documents.length) return "0|" + op;
    var d = app.activeDocument, key = d.fullName ? String(d.fullName) : d.name, n = d.pageItems.length;
    if (_inkSeen[key] === undefined || n < _inkSeen[key]) { _inkSeen[key] = n; return "0|" + op; }
    var added = n - _inkSeen[key]; _inkSeen[key] = n;
    if (added <= 0 || (Number(op) >= 100 && blend == "normal")) return "0|" + op;
    // newest items are at the front of the stacking order; skip locked layers (paper)
    for (var i = 0; i < added && i < d.pageItems.length; i++) {
        var it = d.pageItems[i];
        try { if (it.layer.locked) continue; it.opacity = Number(op); it.blendingMode = blend == "multiply" ? BlendModes.MULTIPLY : BlendModes.NORMAL; } catch (e) {}
    }
    _inkStack.push({ key: key, n: n }); if (_inkStack.length > 200) _inkStack.shift();   // this stamp is its own undo step: inkUndo skips it together with the stroke
    return String(added) + "|" + op;
}
function _pref(k, d) { try { var v = app.preferences.getStringPreference("inkstudio/" + k); return v === "" || v == null ? String(d) : v; } catch (e) { return String(d); } }
function _setPref(k, v) { try { app.preferences.setStringPreference("inkstudio/" + k, String(v)); } catch (e) {} }

/** A medium = brush + a stroke weight that makes it `pt` wide on paper + its opacity and blend mode. */
var _inkNoStyle = false;
function inkUseMedia(lib, bname, pt, op, blend) {
    _inkNoStyle = true; var r; try { r = inkUseBrush(lib, bname); } finally { _inkNoStyle = false; }
    if (r != "ok") return r;
    var d = _doc(), br = _find(d, bname), w = 1;
    if (Number(pt) > 0) try {   // measure the brush's own width at 1 pt (pt 0 = the brush's own size, e.g. pressure pens)
        var t = d.pathItems.add(); t.setEntirePath([[0, 0], [200, 0]]); t.stroked = true; t.filled = false; t.strokeWidth = 1;
        br.applyTo(t); var vb = t.visibleBounds, h = vb[1] - vb[3]; t.remove();
        if (h > 0.01) { w = Math.max(0.01, Math.min(50, Number(pt) / h)); _setPref("inkBrushH", h); }
    } catch (e) {}
    _setWidth(d, w);
    _setPref("inkOp", op); _setPref("inkBlend", blend); _setPref("inkBrush", bname);
    try { _setStyle(d, bname, w, op, blend); } catch (e) {}
    return "ok|" + w;
}

/** New sheet of paper: warm white page, a drawing layer, and paper grain multiplied over everything. */
function inkNewPaper(grain) {
    var old = app.userInteractionLevel; app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    try {
        var W = 595.28, H = 841.89, d = app.documents.add(DocumentColorSpace.RGB, W, H);
        var paper = d.layers[0]; paper.name = "Paper";
        var r = paper.pathItems.rectangle(H, 0, W, H), c = new RGBColor(); c.red = 251; c.green = 248; c.blue = 240;
        r.fillColor = c; r.stroked = false; paper.locked = true;
        var grainL = d.layers.add(); grainL.name = "Paper grain";
        var f = new File(grain);
        if (f.exists) {
            var g = grainL.placedItems.add(); g.file = f;
            g.width = W; g.height = H; g.position = [0, H]; g.embed();
            var it = grainL.pageItems[0]; it.blendingMode = BlendModes.MULTIPLY; it.opacity = 70; it.selected = false;
        }
        d.selection = null;   // before locking: deselecting throws once layers are locked
        grainL.locked = true;
        var draw = d.layers.add(); draw.name = "Drawing"; draw.move(grainL, ElementPlacement.PLACEAFTER);
        d.activeLayer = draw; _deselect(d);
        app.executeMenuCommand("fitall");
        return "ok";
    } catch (e) { return "error: " + e; }
    finally { app.userInteractionLevel = old; }
}


/** Illustrator's own colour picker (the panel's web colour input has no dialog inside Illustrator). Returns "#rrggbb" or "". */
function inkPickColor(hex) {
    var c = _rgb(hex || "#1e1e1e"), r;
    try { r = app.showColorPicker(c); } catch (e) { return ""; }
    if (!r || r.typename != "RGBColor") { try { var a = app.convertSampleColor(ImageColorSpace.CMYK, [r.cyan, r.magenta, r.yellow, r.black], ImageColorSpace.RGB, ColorConvertPurpose.defaultpurpose); r = new RGBColor(); r.red = a[0]; r.green = a[1]; r.blue = a[2]; } catch (e) { return ""; } }
    var v = [r.red, r.green, r.blue], h = "#";
    for (var i = 0; i < 3; i++) { var x = Math.round(v[i]).toString(16); h += x.length < 2 ? "0" + x : x; }
    return h;
}

/** Pressure -> opacity along the newest stroke (InkDraw-style curve). samples: "f,p;f,p;..." with f = position along the
    stroke 0..1 and p = pen pressure 0..1, sent by PenRelay on pen-up. Settings (prefs): inkPO on/off, inkPOmin, inkPOmax (%),
    inkPOcurve (gamma: <1 more opaque early, >1 needs more pressure). Only plain strokes take gradients; brushed strokes are skipped. */
function inkPressureOpacity(samples) {
    if (_pref("inkPO", "0") != "1" || !app.documents.length) return "off";
    var d = app.activeDocument, p = d.pageItems.length ? d.pageItems[0] : null;
    if (!p || p.typename != "PathItem" || !p.stroked || p.layer.locked) return "no stroke";
    if (_pref("inkBrush", "") != "") return "brushed";   // only the plain pens: a brush keeps its own width variation
    var calW = 0;
    var lo = Number(_pref("inkPOmin", 15)), hi = Number(_pref("inkPOmax", 100)), cv = Number(_pref("inkPOcurve", 1));
    var pts = String(samples).split(";"), stops = [];
    for (var i = 0; i < pts.length; i++) { var a = pts[i].split(","); if (a.length == 2) stops.push([Number(a[0]), Number(a[1])]); }
    if (stops.length < 2) return "few samples";
    // the Surface pen reports a narrow pressure band (about 0.1 to 0.5 when drawing normally): stretch each stroke's own
    // range over the full Light..Hard span so easing off visibly lightens the line
    var pmin = 1, pmax = 0; for (var z = 0; z < stops.length; z++) { pmin = Math.min(pmin, stops[z][1]); pmax = Math.max(pmax, stops[z][1]); }
    if (_pref("inkPOstretch", "1") == "1" && pmax - pmin > 0.04)
        for (var z2 = 0; z2 < stops.length; z2++) stops[z2][1] = 0.3 * stops[z2][1] + 0.7 * (stops[z2][1] - pmin) / (pmax - pmin);
    // a copy of the along-stroke template takes the stroke's shape, weight and colour
    var tpl = _alongTemplate(d); if (!tpl) return "no template";
    var q = tpl.duplicate(p, ElementPlacement.PLACEBEFORE); q.hidden = false; q.name = "";
    // wide strokes fold over the tiny hook a pen makes when it touches down or lifts: drop end anchors closer than the width
    var keep = [], W = p.strokeWidth;
    for (var k0 = 0; k0 < p.pathPoints.length; k0++) keep.push(p.pathPoints[k0]);
    function dist(a, b) { return Math.sqrt(Math.pow(a.anchor[0] - b.anchor[0], 2) + Math.pow(a.anchor[1] - b.anchor[1], 2)); }
    while (keep.length > 2 && dist(keep[keep.length - 1], keep[keep.length - 2]) < W * 0.8) keep.splice(keep.length - 1, 1);
    while (keep.length > 2 && dist(keep[0], keep[1]) < W * 0.8) keep.splice(0, 1);
    q.setEntirePath([[0, 0], [1, 0]]);
    while (q.pathPoints.length < keep.length) q.pathPoints.add();
    for (var k = 0; k < keep.length; k++) { var s = keep[k], t = q.pathPoints[k];
        t.anchor = s.anchor; t.leftDirection = s.leftDirection; t.rightDirection = s.rightDirection; t.pointType = s.pointType; }
    q.closed = p.closed; q.strokeWidth = calW > 0 ? calW : p.strokeWidth; q.strokeCap = StrokeCap.BUTTENDCAP;   // caps are drawn outside the along-stroke gradient: round caps show a seam q.strokeJoin = calW > 0 ? StrokeJoin.ROUNDENDJOIN : p.strokeJoin;
    q.opacity = p.opacity; q.blendingMode = p.blendingMode;
    var col = p.strokeColor; if (col.typename == "GradientColor") col = _rgb(_pref("inkColor", "#1e1e1e"));
    var g = d.gradients.add();
    while (g.gradientStops.length < stops.length) g.gradientStops.add();
    for (var j = 0; j < stops.length; j++) {
        var st = g.gradientStops[j], pr = Math.max(0, Math.min(1, stops[j][1]));
        st.rampPoint = Math.max(0, Math.min(100, stops[j][0] * 100)); st.color = col; st.midPoint = 50;
        st.opacity = lo + (hi - lo) * Math.pow(pr, cv);
    }
    var gc = q.strokeColor; gc.gradient = g; q.strokeColor = gc;
    p.remove();
    // the next stroke would inherit this gradient as the current style: put the plain pen style back
    try { _deselect(d); _setStyle(d, "", q.strokeWidth, _pref("inkOp", 100), _pref("inkBlend", "normal")); } catch (e) {}
    return "ok " + stops.length;
}
function _alongTemplate(d) {
    for (var i = 0; i < d.pathItems.length; i++) if (d.pathItems[i].name == "InkStudio along-stroke template") return d.pathItems[i];
    try {   // bring it in from data/along-template.ai: open, copy, paste into a hidden layer
        var src = app.open(new File(File($.fileName).parent.parent.fsName + "/data/along-template.ai")), t = null;
        _deselect(src); src.pathItems[0].selected = true; app.copy(); src.close(SaveOptions.DONOTSAVECHANGES);
        app.activeDocument = d;
        var L = null; try { L = d.layers.getByName("InkStudio"); } catch (e) {}
        if (!L) { L = d.layers.add(); L.name = "InkStudio"; L.move(d, ElementPlacement.PLACEATEND); }
        L.locked = false; L.visible = true; d.activeLayer = L; _deselect(d); app.paste();
        t = d.selection[0]; t.name = "InkStudio along-stroke template"; t.hidden = true; _deselect(d);
        for (var j = 0; j < d.layers.length; j++) if (d.layers[j] !== L && !d.layers[j].locked) { d.activeLayer = d.layers[j]; break; }
        return t;
    } catch (e) { return null; }
}

/** A plain (unbrushed) pen: the stroke that pressure -> opacity works on. */
function inkUsePlain(w, op, blend) {
    var d = _doc(); _deselect(d); _setPref("inkBrush", ""); _setPref("inkOp", op); _setPref("inkBlend", blend); _setWidth(d, Number(w));
    try { _setStyle(d, "", Number(w), op, blend); } catch (e) {}
    return "ok";
}
function inkSetPO(on, lo, hi, cv) { _setPref("inkPO", on ? "1" : "0"); _setPref("inkPOmin", lo); _setPref("inkPOmax", hi); _setPref("inkPOcurve", cv); return "ok"; }
function inkGetPO() { return '{"on":' + (_pref("inkPO", "0") == "1") + ',"min":' + _pref("inkPOmin", 15) + ',"max":' + _pref("inkPOmax", 100) + ',"curve":' + _pref("inkPOcurve", 1) + '}'; }

/** Fake pressure -> opacity for brushed strokes: expand the brush to shapes, clip a white along-stroke "veil" to them.
    The veil is white where pressure was light (1 - opacity). Looks right on white paper. */
function inkVeil(p, samples) {
    var d = app.activeDocument, lo = Number(_pref("inkPOmin", 15)), hi = Number(_pref("inkPOmax", 100)), cv = Number(_pref("inkPOcurve", 1));
    var pts = String(samples).split(";"), stops = [];
    for (var i = 0; i < pts.length; i++) { var a = pts[i].split(","); if (a.length == 2) stops.push([Number(a[0]), Number(a[1])]); }
    var tpl = _alongTemplate(d); if (!tpl) return "no template";
    // veil = copy of the path, plain stroke, wide enough to cover the brush art
    var veil = tpl.duplicate(p, ElementPlacement.PLACEBEFORE); veil.hidden = false; veil.name = "";
    veil.setEntirePath([[0, 0], [1, 0]]);
    while (veil.pathPoints.length < p.pathPoints.length) veil.pathPoints.add();
    for (var k = 0; k < p.pathPoints.length; k++) { var s = p.pathPoints[k], t = veil.pathPoints[k];
        t.anchor = s.anchor; t.leftDirection = s.leftDirection; t.rightDirection = s.rightDirection; t.pointType = s.pointType; }
    var vb = p.visibleBounds; veil.strokeWidth = Math.min(400, 3 * p.strokeWidth * Math.max(1, Number(_pref("inkBrushH", 10)))); veil.strokeCap = StrokeCap.BUTTENDCAP;
    var white = new RGBColor(); white.red = white.green = white.blue = 255;
    var g = d.gradients.add(); while (g.gradientStops.length < stops.length) g.gradientStops.add();
    for (var j = 0; j < stops.length; j++) { var st = g.gradientStops[j], pr = Math.max(0, Math.min(1, stops[j][1]));
        st.rampPoint = Math.max(0, Math.min(100, stops[j][0] * 100)); st.color = white; st.midPoint = 50;
        st.opacity = 100 - (lo + (hi - lo) * Math.pow(pr, cv)); }
    var gc = veil.strokeColor; gc.gradient = g; veil.strokeColor = gc;
    // expand the brushed stroke into shapes; a copy of them becomes the clip
    _deselect(d); p.selected = true; app.executeMenuCommand("expandStyle");
    var art = d.selection[0]; _deselect(d);
    var grp = d.groupItems.add(); grp.move(art, ElementPlacement.PLACEBEFORE);
    var clip = art.duplicate(grp, ElementPlacement.PLACEATBEGINNING);
    veil.move(grp, ElementPlacement.PLACEATEND); art.move(grp, ElementPlacement.PLACEATEND);
    // clip path must be one path or compound path: merge the copy
    _deselect(d); clip.selected = true;
    for (var u = 0; u < 6; u++) { var nested = false; for (var q = 0; q < d.selection.length; q++) if (d.selection[q].typename == "GroupItem") nested = true; if (!nested) break; app.executeMenuCommand("ungroup"); }
    app.executeMenuCommand("compoundPath");
    var cp = d.selection[0]; _deselect(d); cp.move(grp, ElementPlacement.PLACEATBEGINNING);
    // scripting only clips with a plain path on top; the menu command also takes a compound path
    _deselect(d); for (var z = 0; z < grp.pageItems.length; z++) grp.pageItems[z].selected = true;
    app.executeMenuCommand("makeMask"); _deselect(d);
    return "ok";
}
