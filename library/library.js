/* InkStudio brush library: Procreate-like sets + brushes, Illustrator's own brushes and functions. */
var cs = new CSInterface();
var catalog = null, current = null;
var store = {   // favourites, recent, last set: per machine, in the panel's own storage
  get: function (k, d) { try { var v = localStorage.getItem('ink.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('ink.' + k, JSON.stringify(v)); } catch (e) {} }
};
var favs = store.get('favs', []), recent = store.get('recent', []), activeSet = store.get('set', 'Media');
var media = [], packs = [], packBy = {};

function skin() {   // Illustrator's panel colours
  try {
    var s = cs.getHostEnvironment().appSkinInfo, c = s.panelBackgroundColor.color;
    var bg = 'rgb(' + Math.round(c.red) + ',' + Math.round(c.green) + ',' + Math.round(c.blue) + ')';
    document.documentElement.style.setProperty('--bg', bg);
    var light = c.red > 128;
    document.documentElement.style.setProperty('--fg', light ? '#222' : '#d6d6d6');
    document.documentElement.style.setProperty('--row', light ? '#e4e4e4' : 'rgba(255,255,255,.06)');
  } catch (e) {}
}

function load() {
  var path = cs.getSystemPath(SystemPath.EXTENSION) + '/data/catalog.json';
  var r = window.cep.fs.readFile(path);
  catalog = JSON.parse(r.data);
  try { media = JSON.parse(window.cep.fs.readFile(cs.getSystemPath(SystemPath.EXTENSION) + '/data/media.json').data); } catch (e) { media = []; }
  try { packs = JSON.parse(window.cep.fs.readFile(cs.getSystemPath(SystemPath.EXTENSION) + '/data/packs.json').data); } catch (e) { packs = []; }
  packs.forEach(function (p) { packBy[p.set] = p; p.count = 0; });
  catalog.brushes.forEach(function (b) { if (packBy[b.set]) packBy[b.set].count++; });
  setTimeout(function () { var ch = false; media.forEach(function (m) { if (!m.b) return; var i = favs.indexOf(m.b.id); if (i >= 0) { favs[i] = 'media:' + m.label; ch = true; } }); if (ch) { favs = favs.filter(function (x, i) { return favs.indexOf(x) === i; }); store.set('favs', favs); renderList(); } }, 0);
  media.forEach(function (m) { if (m.plain) { m.b = { id: 'plain:' + m.label, name: m.label, file: '', tool: 'Plain', parts: {} }; return; } if (m.file) { m.b = { id: 'adobe:' + m.name, name: m.name, file: m.file, tool: 'Bristle', parts: {} }; return; } m.b = catalog.brushes.filter(function (b) { return b.set === m.set && b.name === m.name; })[0]; });
}

function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function uniq(list) { var o = {}; list.forEach(function (x) { if (x) o[x] = (o[x] || 0) + 1; }); return Object.keys(o).sort().map(function (k) { return [k, o[k]]; }); }
function renderSets() {
  var box = document.getElementById('sets'); box.innerHTML = '';
  ['Media', 'Favourites', 'Recent', 'All packs'].forEach(function (s) { box.appendChild(setRow(s, s)); });
  box.appendChild(el('div', 'set sep', 'Mediums'));
  uniq(packs.map(function (p) { return p.medium; })).forEach(function (m) { box.appendChild(setRow('medium:' + m[0], m[0], m[1])); });
  box.appendChild(el('div', 'set sep', 'Makers'));
  uniq(packs.map(function (p) { return p.author; })).forEach(function (m) { box.appendChild(setRow('maker:' + m[0], m[0], m[1])); });
  box.appendChild(el('div', 'set sep', 'Packs'));
  catalog.sets.forEach(function (s) { box.appendChild(setRow(s, packBy[s] && packBy[s].title || s)); });
}
function setRow(s, label, n) {
  var d = el('div', 'set' + (s === activeSet ? ' on' : ''), label || s);
  if (n) d.appendChild(el('span', 'n', ' ' + n));
  d.onclick = function () { activeSet = s; store.set('set', s); document.getElementById('search').value = ''; renderSets(); renderList(); };
  return d;
}

/** A preview part: the small PNG made by tools/build_thumbs.py, else the decoded SVG. */
function src(part) {
  return part[2] ? 'file://' + cs.getSystemPath(SystemPath.EXTENSION) + '/data/thumbs/' + part[2]
                 : 'file://' + catalog.libDir + '/' + part[0];
}
function preview(b) {
  // Illustrator's thumbnails: the art stretched along a light strip
  var p = el('div', 'p');
  if (b.tool === 'ArtOnPath' && b.parts.art) {
    var img = el('img', 'art'); img.loading = 'lazy'; img.src = src(b.parts.art);
    img.dataset.aspect = b.parts.art[1];
    p.appendChild(img);
  } else if (b.tool === 'PatternOnPath' && b.parts.side) {
    var r = el('div', 'rep'); r.style.backgroundImage = 'url("' + src(b.parts.side) + '")'; p.appendChild(r);
  } else if (b.tool === 'Scatter' && b.parts.tip) {
    var r2 = el('div', 'rep'); r2.style.backgroundImage = 'url("' + src(b.parts.tip) + '")'; r2.style.backgroundSize = 'auto 80%'; p.appendChild(r2);
  } else {
    p.appendChild(el('div', 'cal'));
  }
  return p;
}
/** Art thumbnails: the image at the strip's height, then stretched to the strip's width. */
function stretchArt() {
  Array.prototype.forEach.call(document.querySelectorAll('img.art'), function (img) {
    var box = img.parentNode, W = box.clientWidth * 0.88, H = box.clientHeight * 0.7, a = Number(img.dataset.aspect) || 3;
    img.style.height = H + 'px'; img.style.width = (H * a) + 'px';
    img.style.transform = 'scaleX(' + (W / (H * a)) + ')';
  });
}

function renderList() {
  var q = document.getElementById('search').value.trim().toLowerCase();
  var list = document.getElementById('list'); list.innerHTML = '';
  var items;
  if (q) {
    var hitPacks = packs.filter(function (p) { return [p.set, p.title, p.author, p.medium, (p.tags || []).join(' '), p.intro, p.best_for].join(' ').toLowerCase().indexOf(q) >= 0; });
    hitPacks.slice(0, 12).forEach(function (p) { list.appendChild(packCard(p, false)); });
    items = catalog.brushes.filter(function (b) { return (b.set + ' ' + b.name).toLowerCase().indexOf(q) >= 0; }).slice(0, 300);
  }
  else if (activeSet === 'Media') return renderMedia(list);
  else if (activeSet === 'All packs' || /^(medium|maker|tag):/.test(activeSet)) return renderPacks(list);
  else if (activeSet === 'Favourites') {
    favs.forEach(function (id) { if (id.indexOf('media:') === 0) { var m = media.filter(function (x) { return 'media:' + x.label === id && x.b; })[0]; if (m) list.appendChild(mediaRow(m)); } });
    items = favs.filter(function (id) { return id.indexOf('media:') !== 0; }).map(byId).filter(Boolean);
    if (!items.length && list.children.length) { stretchArt(); return; }
  }
  else if (activeSet === 'Recent') items = recent.map(byId).filter(Boolean);
  else { items = catalog.brushes.filter(function (b) { return b.set === activeSet; }); if (packBy[activeSet]) list.appendChild(packCard(packBy[activeSet], true)); }
  if (!items.length) list.appendChild(el('div', 'set', activeSet === 'Favourites' ? 'Tap the star on a brush to keep it here.' : 'No brushes.'));
  items.forEach(function (b) {
    var row = el('div', 'b' + (current === b.id ? ' on' : ''));
    var n = el('div', 'n'); n.appendChild(el('span', null, q || activeSet === 'Favourites' || activeSet === 'Recent' ? b.set + ': ' + b.name : b.name));
    var star = el('span', 'star' + (favs.indexOf(b.id) >= 0 ? ' fav' : ''), '★');
    star.onclick = function (ev) { ev.stopPropagation(); toggleFav(b.id); };
    n.appendChild(star); row.appendChild(n); row.appendChild(preview(b));
    row.onclick = function () { use(b, row); };
    list.appendChild(row);
  });
  stretchArt();
}
/** Media: one tap = a real-world tool (brush, size on paper, opacity, blend). */
function renderMedia(list) {
  var lastSec = '';
  media.forEach(function (m) {
    if (!m.b) return;
    if ((m.section || 'Media') !== lastSec) { lastSec = m.section || 'Media'; if (lastSec === 'Pressure') list.appendChild(poCard()); list.appendChild(el('div', 'set sep', lastSec === 'Pressure' ? 'Pressure → opacity pens' : lastSec === 'Live' ? 'Live with pressure: Paintbrush (B)' : 'Textured: live with the Pencil (N)')); }
    list.appendChild(mediaRow(m));
  });
  stretchArt();
}
var po = { on: false, min: 15, max: 100, curve: 1 };
function loadPO() { host('inkGetPO()', function (r) { try { po = JSON.parse(r); if (activeSet === 'Media') renderList(); } catch (e) {} }); }
function savePO() { host('inkSetPO(' + po.on + ',' + po.min + ',' + po.max + ',' + po.curve + ')'); }
function poCard() {
  var c = el('div', 'card po');
  var h = el('label', 'ct'); var cb = el('input'); cb.type = 'checkbox'; cb.checked = po.on; cb.onchange = function () { po.on = cb.checked; savePO(); };
  h.appendChild(cb); h.appendChild(el('span', 'title', ' Pressure → opacity')); c.appendChild(h);
  function sl(label, key, mn, mx, st, fmt) {
    var r = el('div', 'posl'); var lb = el('span', 'dim', label); var v = el('span', 'val', fmt(po[key]));
    var i = el('input'); i.type = 'range'; i.min = mn; i.max = mx; i.step = st; i.value = po[key];
    i.oninput = function () { po[key] = Number(i.value); v.textContent = fmt(po[key]); drawCurve(); }; i.onchange = savePO;
    r.appendChild(lb); r.appendChild(i); r.appendChild(v); c.appendChild(r);
  }
  var cv = el('canvas'); cv.width = 220; cv.height = 70; cv.className = 'pocurve';
  function drawCurve() { var g = cv.getContext('2d'); g.clearRect(0, 0, 220, 70); g.strokeStyle = '#1473e6'; g.lineWidth = 2; g.beginPath();
    for (var x = 0; x <= 100; x++) { var p = x / 100, o = (po.min + (po.max - po.min) * Math.pow(p, po.curve)) / 100; var X = 5 + p * 210, Y = 65 - o * 60; if (x) g.lineTo(X, Y); else g.moveTo(X, Y); } g.stroke();
    g.fillStyle = '#8a8a8a'; g.font = '9px sans-serif'; g.fillText('light', 5, 68); g.fillText('hard', 196, 68); }
  sl('Light', 'min', 0, 100, 1, function (x) { return x + '%'; });
  sl('Hard', 'max', 0, 100, 1, function (x) { return x + '%'; });
  sl('Curve', 'curve', 0.2, 3, 0.1, function (x) { return Number(x).toFixed(1); });
  c.appendChild(cv); setTimeout(drawCurve, 0);
  c.appendChild(el('div', 'tip', 'Applied when you lift the pen. Works on these three plain pens.'));
  return c;
}
function mediaRow(m) {
    var row = el('div', 'b' + (current === m.b.id ? ' on' : ''));
    var n = el('div', 'n'); n.appendChild(el('span', null, m.label)); var rt = el('span'); if (m.op < 100) rt.appendChild(el('span', 'dim', m.op + '% ')); rt.appendChild(starEl('media:' + m.label)); n.appendChild(rt);
    row.appendChild(n);
    if (m.plain) { var pp = el('div', 'p'); var bar = el('div', 'pobar'); bar.style.height = Math.max(3, Math.min(22, m.pt * 1.5)) + 'px'; pp.appendChild(bar); row.appendChild(pp); }
    else if (m.thumb) { var pv = el('div', 'p'); var im = el('img', 'pen'); im.src = 'file://' + cs.getSystemPath(SystemPath.EXTENSION) + '/data/thumbs/' + m.thumb; pv.appendChild(im); row.appendChild(pv); } else row.appendChild(preview(m.b));
    if (m.plain) { row.onclick = function () { host('inkUsePlain(' + m.pt + ',' + m.op + ',"' + m.blend + '")', function () { current = m.b.id; toast(m.label + ' ready: N for Pencil'); Array.prototype.forEach.call(document.querySelectorAll('.b.on'), function (e) { e.classList.remove('on'); }); row.classList.add('on'); }); }; return row; }
    row.onclick = function () {
      row.classList.add('busy');
      host('inkUseMedia("' + esc(brushFile(m.b)) + '","' + esc(m.b.name) + '",' + m.pt + ',' + m.op + ',"' + m.blend + '")', function (res) {
        row.classList.remove('busy');
        if (String(res).indexOf('ok') !== 0) { row.title = res; toast('Could not load ' + m.label); return; }
        current = m.b.id; toast(m.label + ' ready: N for Pencil');
        Array.prototype.forEach.call(document.querySelectorAll('.b.on'), function (e) { e.classList.remove('on'); });
        row.classList.add('on');
      });
    };
    return row;
}
function go(set) { activeSet = set; store.set('set', set); document.getElementById('search').value = ''; renderSets(); renderList(); document.getElementById('list').scrollTop = 0; }
function packCard(p, open) {
  var c = el('div', 'card');
  var h = el('div', 'ct'); h.appendChild(el('span', 'title', p.title || p.set)); h.appendChild(el('span', 'dim', p.count + ' brushes')); c.appendChild(h);
  var meta = el('div', 'meta');
  if (p.author) { var a = el('span', 'link', p.author); a.onclick = function (e) { e.stopPropagation(); go('maker:' + p.author); }; meta.appendChild(a); meta.appendChild(document.createTextNode(': ')); }
  var md = el('span', 'link', p.medium); md.onclick = function (e) { e.stopPropagation(); go('medium:' + p.medium); }; meta.appendChild(md);
  c.appendChild(meta);
  var tags = el('div', 'tags'); (p.tags || []).forEach(function (t) { var x = el('span', 'tag', t); x.onclick = function (e) { e.stopPropagation(); go('tag:' + t); }; tags.appendChild(x); }); c.appendChild(tags);
  if (p.intro) c.appendChild(el('div', 'intro', p.intro));
  if (p.best_for) c.appendChild(el('div', 'best', 'Best for ' + p.best_for));
  (p.highlights || []).forEach(function (n) {
    var b = catalog.brushes.filter(function (x) { return x.set === p.set && x.name === n; })[0]; if (!b) return;
    var row = el('div', 'hl'); var hn = el('div', 'hn'); hn.appendChild(el('span', null, b.name)); hn.appendChild(starEl(b.id)); row.appendChild(hn); row.appendChild(preview(b));
    row.onclick = function (e) { e.stopPropagation(); use(b, row); }; c.appendChild(row);
  });
  if (open && p.tip) c.appendChild(el('div', 'tip', p.tip));
  if (!open) { var more = el('div', 'more', 'Open pack'); c.appendChild(more); c.onclick = function () { go(p.set); }; }
  return c;
}
function renderPacks(list) {
  var k = activeSet.split(':'), kind = k[0], v = k.slice(1).join(':');
  var ps = packs.filter(function (p) { return kind === 'All packs' || (kind === 'medium' && p.medium === v) || (kind === 'maker' && p.author === v) || (kind === 'tag' && (p.tags || []).indexOf(v) >= 0); });
  list.appendChild(el('div', 'set sep', (kind === 'All packs' ? 'All packs' : v) + ': ' + ps.length + ' packs'));
  ps.forEach(function (p) { list.appendChild(packCard(p, false)); });
  stretchArt();
}
var byIdMap = null;
function byId(id) { if (!byIdMap) { byIdMap = {}; catalog.brushes.forEach(function (b) { byIdMap[b.id] = b; }); media.forEach(function (m) { if (m.b && !byIdMap[m.b.id]) byIdMap[m.b.id] = m.b; }); } return byIdMap[id]; }
function starEl(id) {
  var st = el('span', 'star' + (favs.indexOf(id) >= 0 ? ' fav' : ''), '★');
  st.title = 'Favourite'; st.onclick = function (ev) { ev.stopPropagation(); toggleFav(id); }; return st;
}
function toggleFav(id) { var i = favs.indexOf(id); if (i >= 0) favs.splice(i, 1); else favs.unshift(id); store.set('favs', favs); renderList(); }

var toastTimer = 0;
function toast(text) {
  var t = document.getElementById('toast');
  if (!t) { t = el('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
}
/** host functions fresh from disk before each action, so an updated host.jsx works without restarting Illustrator */
function host(call, cb) { cs.evalScript('$.evalFile("' + esc(cs.getSystemPath(SystemPath.EXTENSION) + '/jsx/host.jsx') + '");' + call, cb); }
function esc(s) { return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
/** The .ai file a brush loads from: packaged builds keep them under the extension (catalog.brushDir). */
function brushFile(b) { if (/^adobe:/.test(b.file)) return b.file; return catalog.brushDir ? cs.getSystemPath(SystemPath.EXTENSION) + '/' + b.file : b.file; }
function use(b, row) {
  row.classList.add('busy');
  host('inkUseBrush("' + esc(brushFile(b)) + '","' + esc(b.name) + '")', function (res) {
    row.classList.remove('busy');
    if (String(res).indexOf('error') === 0) { row.title = res; toast('Could not load ' + b.name); return; }
    toast(b.name + ' ready: N for Pencil');
    current = b.id;
    recent = [b.id].concat(recent.filter(function (x) { return x !== b.id; })).slice(0, 30); store.set('recent', recent);
    Array.prototype.forEach.call(document.querySelectorAll('.b.on'), function (e) { e.classList.remove('on'); });
    row.classList.add('on');
  });
}

// (re)load the host functions: they load once at panel start, a page reload would keep old ones
cs.evalScript('$.evalFile("' + cs.getSystemPath(SystemPath.EXTENSION) + '/jsx/host.jsx")');
skin(); load(); renderSets(); renderList(); loadPO();
document.getElementById('search').oninput = renderList;
window.addEventListener('resize', stretchArt);
cs.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, skin);
