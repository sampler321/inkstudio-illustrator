// Tiny CDP client for the InkStudio panels (they run hidden while Illustrator is in the background).
// usage: node cdp.mjs <port> eval "<js>"   |   node cdp.mjs <port> shot out.png [w h]
const [port, cmd, arg, w, h] = process.argv.slice(2);
const list = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
let id = 0; const pending = {};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } };
await new Promise(r => ws.onopen = r);
if (cmd === 'eval') {
  const r = await send('Runtime.evaluate', { expression: arg, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result.result?.value ?? r.result));
} else if (cmd === 'reload') {
  await send('Page.reload', { ignoreCache: true }); console.log('reloaded');
} else if (cmd === 'shot') {
  if (w) await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 2, mobile: false });
  const r = await send('Page.captureScreenshot', { format: 'png' });
  (await import('fs')).writeFileSync(arg, Buffer.from(r.result.data, 'base64'));
  console.log('ok');
}
ws.close();
