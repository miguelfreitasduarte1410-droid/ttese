// Diagnóstico do T.T.E. — rode: node diagnostico.js   (ou dois cliques em diagnostico.bat)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const OLLAMA = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'gemma3:12b';
const SITE = process.env.SITE_URL || 'http://127.0.0.1:' + (process.env.PORT || 3000);
let falhas = 0, avisos = 0;
const ok = m => console.log('  [ OK ]  ' + m);
const bad = (m, dica) => { falhas++; console.log('  [FALHA] ' + m + (dica ? '\n          → ' + dica : '')); };
const warn = (m, dica) => { avisos++; console.log('  [AVISO] ' + m + (dica ? '\n          → ' + dica : '')); };
const get = async (u, ms = 4000) => (await fetch(u, { signal: AbortSignal.timeout(ms) })).json();
function has(cmd) { try { cp.execSync((process.platform === 'win32' ? 'where ' : 'which ') + cmd, { stdio: 'ignore' }); return true; } catch { return false; } }

(async () => {
  console.log('\nDIAGNÓSTICO T.T.E.\n');
  console.log('1) Programas');
  const major = +process.versions.node.split('.')[0];
  major >= 18 ? ok('Node ' + process.version) : bad('Node ' + process.version + ' é antigo', 'Instale o Node.js LTS (18 ou mais novo): https://nodejs.org');
  has('ollama') ? ok('Ollama instalado') : bad('Ollama não encontrado', 'Instale: https://ollama.com/download');
  has('cloudflared') ? ok('cloudflared instalado (link público)') : warn('cloudflared não encontrado: o site só abre neste PC', 'winget install Cloudflare.cloudflared');

  console.log('\n2) Arquivos do site');
  for (const f of ['index.html', 'instagram.html', 'ajuda.html', 'config.js', 'server.js', 'assets/debug.js', 'assets/favicon.png', 'assets/neonote.jpg', 'assets/neoink.jpg', 'assets/neonote-detalhe.jpg', 'assets/neoink-detalhe.jpg', 'assets/instagram-tte.jpg'])
    fs.existsSync(path.join(__dirname, f)) ? ok(f) : bad('Faltando: ' + f, 'Extraia o zip inteiro, mantendo a pasta assets.');

  console.log('\n3) IA (Ollama)');
  let tags = null;
  try { tags = await get(OLLAMA + '/api/tags'); ok('Ollama respondendo em ' + OLLAMA); } catch { bad('Ollama não respondeu em ' + OLLAMA, 'Abra o Ollama (bandeja do Windows) ou rode: ollama serve'); }
  if (tags) {
    const names = (tags.models || []).map(m => m.name);
    names.some(n => n === MODEL || n.split(':')[0] === MODEL) ? ok('Modelo ' + MODEL + ' instalado') : bad('Modelo ' + MODEL + ' não instalado (instalados: ' + (names.join(', ') || 'nenhum') + ')', 'Rode: ollama pull ' + MODEL);
    try {
      const t = Date.now();
      const r = await fetch(OLLAMA + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000), body: JSON.stringify({ model: MODEL, stream: false, messages: [{ role: 'user', content: 'Responda apenas: ok' }], options: { num_predict: 20 } }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
      ok('Resposta de teste em ' + ((Date.now() - t) / 1000).toFixed(1) + ' s (a 1ª vez é mais lenta: carrega o modelo)');
      const ps = (await get(OLLAMA + '/api/ps')).models || [];
      const m = ps.find(x => x.name === MODEL || x.name.split(':')[0] === MODEL);
      if (m) { const g = (m.size_vram || 0) / (m.size || 1); g > 0.95 ? ok('Modelo 100% na placa de vídeo (' + Math.round(m.size_vram / 1048576) + ' MB de VRAM)') : g > 0 ? warn('Modelo só ' + Math.round(g * 100) + '% na GPU — ficará lento', 'Use um modelo menor: set OLLAMA_MODEL=llama3.1:8b') : bad('Modelo rodando na CPU, não na placa de vídeo', 'Atualize o driver NVIDIA e o Ollama; confirme com: nvidia-smi'); }
    } catch (e) { bad('Teste de resposta falhou: ' + e.message, 'Veja a janela do Ollama; pouca VRAM/RAM livre é a causa mais comum.'); }
  }

  console.log('\n4) Servidor do site');
  try {
    const h = await get(SITE + '/api/health');
    ok('Servidor no ar em ' + SITE + (h.debug ? ' (DEBUG ligado)' : ''));
    h.ok ? ok('Servidor enxerga a IA e o modelo') : bad('Servidor no ar, mas a IA não está pronta', h.dica || h.erro);
  } catch { warn('Servidor não está rodando em ' + SITE, 'Dê dois cliques em iniciar.bat (ou: node server.js)'); }

  console.log('\n' + (falhas ? 'RESULTADO: ' + falhas + ' falha(s), ' + avisos + ' aviso(s). Corrija as linhas [FALHA] acima.' : 'RESULTADO: tudo certo' + (avisos ? ' (' + avisos + ' aviso(s))' : '') + ' ✔') + '\n');
  process.exit(falhas ? 1 : 0);
})();
