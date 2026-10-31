/* T.T.E. — modo debug. Invisível para visitantes.
   Ligar: abra qualquer página com ?debug=1 (desligar: ?debug=0), ou Ctrl+Alt+D, ou digite /debug no chat. */
(function () {
  if (window.TTE_DEBUG) return;
  const T0 = Date.now(), logs = [], net = [], MAX = 200;
  let panel = null, body = null, tab = 'status', health = null, testOut = '';
  const api = () => (window.TTE_API_URL || '').replace(/\/$/, '');
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function push(type, msg) { logs.push({ t: ((Date.now() - T0) / 1000).toFixed(1), type, msg: String(msg).slice(0, 400) }); if (logs.length > MAX) logs.shift(); refresh(); }
  function enabled() { try { if (/[?&]debug=0/.test(location.search)) { localStorage.removeItem('tte-debug'); return false; } if (/[?&]debug=1/.test(location.search)) localStorage.setItem('tte-debug', '1'); return localStorage.getItem('tte-debug') === '1'; } catch (e) { return /[?&]debug=1/.test(location.search); } }

  addEventListener('error', e => {
    const el = e.target;
    if (el && el !== window && el.tagName) push('recurso', 'Falhou ao carregar <' + el.tagName.toLowerCase() + '> ' + (el.src || el.href || ''));
    else push('erro', (e.message || 'erro') + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')');
  }, true);
  addEventListener('unhandledrejection', e => push('promise', (e.reason && e.reason.message) || e.reason));
  ['error', 'warn'].forEach(k => { const o = console[k]; console[k] = function () { try { push('console.' + k, [].map.call(arguments, String).join(' ')); } catch (_) { } return o.apply(console, arguments); }; });
  if (window.fetch) {
    const of = window.fetch;
    window.fetch = function (u, o) {
      const s = performance.now(), url = String((u && u.url) || u), method = (o && o.method) || 'GET';
      const rec = x => { net.push(Object.assign({ method, url, ms: Math.round(performance.now() - s) }, x)); if (net.length > 50) net.shift(); refresh(); };
      return of.apply(this, arguments).then(r => { rec({ status: r.status }); return r; }, e => { rec({ status: 'FALHA', err: e.message }); throw e; });
    };
  }

  function brokenImages() { return [].filter.call(document.images, i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')); }
  async function checkHealth() {
    try { const r = await fetch(api() + '/api/health', { cache: 'no-store' }); health = await r.json(); health._http = r.status; }
    catch (e) { health = { erro: e.message, dica: location.protocol === 'file:' ? 'Página aberta como arquivo: a IA só funciona pelo servidor (node server.js).' : 'Servidor fora do ar ou link do túnel mudou.' }; }
    refresh();
  }
  async function testAI() {
    testOut = 'Testando…'; refresh(); const s = performance.now(); let first = 0, txt = '';
    try {
      const r = await fetch(api() + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Diga olá em uma frase curta.' }) });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + JSON.stringify(await r.json().catch(() => ({}))));
      const rd = r.body.getReader(), dc = new TextDecoder();
      for (;;) { const { done, value } = await rd.read(); if (done) break; if (!first) first = performance.now() - s; txt += dc.decode(value, { stream: true }); }
      testOut = 'OK · 1º trecho em ' + Math.round(first) + ' ms · total ' + Math.round(performance.now() - s) + ' ms · ' + txt.length + ' caracteres\n“' + txt.trim() + '”';
    } catch (e) { testOut = 'FALHOU: ' + e.message; }
    refresh();
  }
  function report() {
    const L = [];
    L.push('RELATÓRIO T.T.E. DEBUG — ' + new Date().toLocaleString('pt-BR'));
    L.push('Página: ' + location.href); L.push('Navegador: ' + navigator.userAgent);
    L.push('Tela: ' + innerWidth + 'x' + innerHeight + ' · tema: ' + (document.documentElement.getAttribute('data-theme') || '?') + ' · online: ' + navigator.onLine);
    L.push('API: ' + (api() || '(mesmo endereço)')); L.push('Saúde da IA: ' + JSON.stringify(health));
    L.push('Imagens quebradas: ' + (brokenImages().join(', ') || 'nenhuma'));
    L.push('--- Erros/avisos (' + logs.length + ')'); logs.forEach(l => L.push('[' + l.t + 's] ' + l.type + ': ' + l.msg));
    L.push('--- Rede'); net.forEach(n => L.push(n.method + ' ' + n.url + ' → ' + n.status + ' (' + n.ms + ' ms)' + (n.err ? ' ' + n.err : '')));
    return L.join('\n');
  }

  const css = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;width:min(440px,calc(100vw - 24px));max-height:62vh;display:flex;flex-direction:column;background:#0a1220;color:#d8e6f5;border:1px solid #3aa9c9;border-radius:12px;font:12px/1.5 ui-monospace,Consolas,monospace;box-shadow:0 10px 40px #000a';
  const btn = 'background:#12304a;color:#d8e6f5;border:1px solid #3a6f8f;border-radius:6px;padding:4px 9px;font:inherit;cursor:pointer;margin:0 4px 4px 0';
  function view() {
    if (tab === 'status') {
      const b = brokenImages();
      return '<b>Página</b> ' + esc(location.pathname) + '\n<b>Tela</b> ' + innerWidth + 'x' + innerHeight + ' · <b>tema</b> ' + esc(document.documentElement.getAttribute('data-theme') || '?') + '\n<b>Online</b> ' + navigator.onLine + ' · <b>protocolo</b> ' + esc(location.protocol) + '\n<b>API</b> ' + esc(api() || '(mesmo endereço)') + '\n<b>Erros</b> ' + logs.filter(l => l.type !== 'console.warn').length + ' · <b>imagens quebradas</b> ' + b.length + (b.length ? '\n' + esc(b.join('\n')) : '') + '\n<b>Imagens</b> ' + document.images.length + ' · <b>scripts</b> ' + document.scripts.length;
    }
    if (tab === 'ia') return '<button data-a="health" style="' + btn + '">Verificar IA</button><button data-a="test" style="' + btn + '">Testar resposta</button>\n' + (health ? esc(JSON.stringify(health, null, 2)) : 'Clique em “Verificar IA”.') + '\n\n' + esc(testOut);
    if (tab === 'erros') return logs.length ? logs.slice().reverse().map(l => '<span style="color:' + (l.type === 'console.warn' ? '#e9c46a' : '#ff7b7b') + '">[' + l.t + 's] ' + esc(l.type) + '</span> ' + esc(l.msg)).join('\n') : 'Nenhum erro registrado ✔';
    return net.length ? net.slice().reverse().map(n => '<span style="color:' + (typeof n.status === 'number' && n.status < 400 ? '#7be0a0' : '#ff7b7b') + '">' + n.status + '</span> ' + esc(n.method) + ' ' + esc(n.url) + ' · ' + n.ms + ' ms' + (n.err ? ' · ' + esc(n.err) : '')).join('\n') : 'Nenhuma chamada de rede ainda.';
  }
  function refresh() { if (!body) return; body.innerHTML = view(); const c = panel.querySelector('[data-c]'); if (c) c.textContent = logs.length ? ' (' + logs.length + ')' : ''; }
  function open() {
    if (panel) { panel.style.display = 'flex'; refresh(); return; }
    panel = document.createElement('div'); panel.setAttribute('style', css);
    panel.innerHTML = '<div style="display:flex;flex-wrap:wrap;align-items:center;padding:8px 8px 4px;border-bottom:1px solid #1d4a63"><b style="color:#5fe3e0;margin-right:8px">T.T.E. DEBUG</b>' + [['status', 'Status'], ['ia', 'IA'], ['erros', 'Erros<span data-c></span>'], ['rede', 'Rede']].map(t => '<button data-t="' + t[0] + '" style="' + btn + '">' + t[1] + '</button>').join('') + '<span style="flex:1"></span><button data-a="copy" style="' + btn + '">Copiar relatório</button><button data-a="clear" style="' + btn + '">Limpar</button><button data-a="off" style="' + btn + '">✕</button></div><div data-b style="padding:10px;overflow:auto;white-space:pre-wrap;word-break:break-word"></div>';
    document.body.appendChild(panel); body = panel.querySelector('[data-b]');
    panel.addEventListener('click', e => {
      const t = e.target.closest('[data-t]'), a = e.target.closest('[data-a]');
      if (t) { tab = t.dataset.t; if (tab === 'ia' && !health) checkHealth(); refresh(); }
      if (!a) return; const k = a.dataset.a;
      if (k === 'health') checkHealth(); if (k === 'test') testAI();
      if (k === 'clear') { logs.length = 0; net.length = 0; refresh(); }
      if (k === 'off') { panel.style.display = 'none'; try { localStorage.removeItem('tte-debug'); } catch (_) { } }
      if (k === 'copy') { const r = report(); (navigator.clipboard ? navigator.clipboard.writeText(r) : Promise.reject()).then(() => { a.textContent = 'Copiado ✔'; }, () => { prompt('Copie o relatório:', r); }); }
    });
    refresh();
  }
  addEventListener('keydown', e => { if (e.ctrlKey && e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); panel && panel.style.display !== 'none' ? (panel.style.display = 'none') : open(); } });
  window.TTE_DEBUG = { open, report, logs, net, enable() { try { localStorage.setItem('tte-debug', '1'); } catch (_) { } open(); } };
  document.addEventListener('DOMContentLoaded', () => { if (enabled()) open(); });
})();
