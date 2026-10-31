// Servidor do site T.T.E. + J.A.R.V.I.S. (IA local via Ollama). Sem dependências: só Node 18+.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const OLLAMA = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'gemma3:12b';
const NUM_CTX = +process.env.NUM_CTX || 4096;
const MAX_TOKENS = +process.env.MAX_TOKENS || 700;
const RATE_PER_MIN = +process.env.RATE_PER_MIN || 20;   // por visitante
const MAX_PARALLEL = +process.env.MAX_PARALLEL || 2;    // respostas ao mesmo tempo
const MAX_QUEUE = +process.env.MAX_QUEUE || 8;          // pessoas esperando
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ''; // só se o site ficar em outro domínio
const ROOT = __dirname;
const DEBUG = /^(1|true|on)$/i.test(process.env.DEBUG || '');
const START = Date.now();
const events = []; const stats = { chat: 0, ok: 0, erros: 0, limitados: 0, ocupado: 0 };
const mask = ip => String(ip).replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.x.x');
function ev(type, data = {}) {
  const e = { t: new Date().toISOString(), type, ...data };
  events.push(e); if (events.length > 100) events.shift();
  if (DEBUG) {
    console.log('[debug]', e.t.slice(11, 19), type, JSON.stringify(data));
    try { fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true }); fs.appendFile(path.join(ROOT, 'logs', 'debug.log'), JSON.stringify(e) + '\n', () => {}); } catch { /* ignora */ }
  }
}
const isLocal = req => !req.headers['cf-connecting-ip'] && !req.headers['x-forwarded-for'] && /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '');

const CONTEXT = `
PROJETO T.T.E — Technology Transform Education
A T.T.E é uma empresa fictícia criada para um trabalho escolar do 9º ano do Colégio Santa Teresa de Jesus. A proposta é transformar a educação por meio da tecnologia e tornar os estudos mais acessíveis, organizados, eficientes e interativos. O site e os produtos são conceitos de um projeto escolar, não uma empresa comercial real nem parcerias oficiais.
NeoNote: tablet inteligente idealizado para reunir anotações, livros, arquivos e materiais escolares em um único espaço digital. Funciona como caderno e livro digital. Anotações organizadas por matéria e tema, leitura de livros e materiais digitais, armazenamento local com apoio de sistemas em nuvem (a nuvem poderia ampliar o espaço; a capacidade real dependeria do serviço usado) e integração com a NeoInk.
NeoInk: caneta digital idealizada com ponta óptica (scanner) que reconhece textos ao apontar ou passar sobre eles, traduz palavras e conteúdos, lê em voz alta por meio do sistema conectado e envia os resultados ao NeoNote.
Como funciona: 1) Escanear: o estudante aponta a NeoInk para um texto. 2) Traduzir e ouvir: o sistema traduz e lê em voz alta. 3) Guardar e estudar: o conteúdo vai para o NeoNote para consulta, organização e revisão.
Ideia de expansão: a T.T.E imagina apresentar o projeto ao governo para discutir levar os produtos a escolas públicas. É uma ideia do projeto, não uma parceria oficial. Na vida real seria preciso avaliar custos, produção, acessibilidade, infraestrutura das escolas, proteção de dados, manutenção e aprovação dos órgãos responsáveis.
Parceria conceitual T.T.E × 360 Tech: ideia de combinar tablets e canetas da T.T.E com hologramas/projetor 3D e luvas de interação da 360 Tech para um aprendizado mais visual e interativo. É conceito, não parceria confirmada.
Objetivo educativo: treinar os estudantes para desafios futuros, desenvolvendo pesquisa, criatividade, planejamento, comunicação e trabalho em equipe.
Autores do trabalho: Miguel Freitas, Augusto Stein, Davi Acosta e Jean Carlos. Site desenvolvido por Miguel Freitas Duarte.
Instagram: @tte.futuro (https://www.instagram.com/tte.futuro/).
O site tem as páginas Início, Instagram e Ajuda, e uma simulação interativa do NeoNote (caderno, biblioteca por matérias, meu dia e perguntas ao professor — tudo apenas demonstrativo).`;

const SYSTEM = `Você é o J.A.R.V.I.S., assistente virtual da T.T.E. Fale em português brasileiro, de forma natural, clara e amigável, sem soar robótico. Responda SOMENTE perguntas sobre o trabalho escolar T.T.E e apenas com base no contexto abaixo. Não invente funcionalidades, fatos, preços, datas, resultados ou parcerias confirmadas. Se a pergunta fugir do projeto, diga brevemente que só pode ajudar com dúvidas sobre a T.T.E. Se o contexto não trouxer a resposta, diga que essa informação não foi definida no trabalho. Prefira respostas curtas ou médias (no máximo 4 frases), sem listas longas.
Contexto:
${CONTEXT}`;

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const PUBLIC_FILES = new Set(['index.html', 'instagram.html', 'ajuda.html', 'config.js']);

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

// ---- limite por visitante ----
const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > RATE_PER_MIN;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 60000)) hits.delete(k); }, 60000).unref();

// ---- fila simples ----
let running = 0; const waiting = [];
function acquire() {
  if (running < MAX_PARALLEL) { running++; return Promise.resolve(true); }
  if (waiting.length >= MAX_QUEUE) return Promise.resolve(false);
  return new Promise(r => waiting.push(r));
}
function release() { const next = waiting.shift(); if (next) next(true); else running--; }

function readBody(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleChat(req, res) {
  const t0 = Date.now(), ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'x';
  stats.chat++;
  if (limited(ip)) { stats.limitados++; ev('limite', { ip: mask(ip) }); return json(res, 429, { error: 'Muitas perguntas seguidas. Aguarde um instante.' }); }
  let body;
  try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'Pedido inválido.' }); }
  const message = String(body.message || '').trim();
  if (!message) return json(res, 400, { error: 'Digite uma pergunta.' });
  if (message.length > 600) return json(res, 413, { error: 'A pergunta é muito longa. Tente resumir.' });
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 800) }));

  ev('chat_pedido', { ip: mask(ip), chars: message.length, historico: history.length, rodando: running, esperando: waiting.length });
  if (!(await acquire())) { stats.ocupado++; ev('fila_cheia', { esperando: waiting.length }); return json(res, 503, { error: 'O assistente está ocupado. Tente de novo em instantes.' }); }
  if (res.destroyed || res.writableEnded) { release(); ev('abandonado_na_fila', { ip: mask(ip) }); return; }
  const ctrl = new AbortController();
  res.on('close', () => ctrl.abort());
  let first = 0, sent = 0;
  try {
    const up = await fetch(OLLAMA + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL, stream: true, keep_alive: '30m',
        messages: [{ role: 'system', content: SYSTEM }, ...history, { role: 'user', content: message }],
        options: { temperature: 0.3, num_ctx: NUM_CTX, num_predict: MAX_TOKENS }
      })
    });
    if (!up.ok) {
      const txt = (await up.text()).slice(0, 200); stats.erros++;
      ev('erro_ollama', { status: up.status, detalhe: txt }); console.error('Ollama respondeu', up.status, txt);
      return json(res, 502, { error: up.status === 404 ? 'Modelo de IA não instalado no computador host.' : 'A IA não conseguiu responder agora.' });
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of up.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try { const t = JSON.parse(line)?.message?.content; if (t) { if (!first) first = Date.now() - t0; sent += t.length; res.write(t); } } catch { /* linha parcial */ }
      }
    }
    res.end(); stats.ok++;
    ev('chat_fim', { primeiro_token_ms: first, total_ms: Date.now() - t0, caracteres: sent });
  } catch (e) {
    if (ctrl.signal.aborted) { ev('cliente_saiu', { apos_ms: Date.now() - t0 }); return; }
    stats.erros++; ev('erro_conexao', { msg: e.message }); console.error('Falha ao falar com o Ollama:', e.message);
    if (!res.headersSent) json(res, 502, { error: 'O computador da IA está desligado ou o Ollama não está aberto.' });
    else res.end();
  } finally { release(); }
}

async function ollamaGet(p) { const r = await fetch(OLLAMA + p, { signal: AbortSignal.timeout(3000) }); return r.json(); }
async function handleHealth(req, res) {
  const out = { ok: false, ollama: false, model: MODEL, modelInstalled: false, ocupado: running >= MAX_PARALLEL };
  try {
    const d = await ollamaGet('/api/tags'); const names = (d.models || []).map(m => m.name);
    out.ollama = true; out.modelInstalled = names.some(n => n === MODEL || n.split(':')[0] === MODEL);
    out.ok = out.modelInstalled;
    if (isLocal(req)) {
      out.instalados = names;
      try { out.carregados = ((await ollamaGet('/api/ps')).models || []).map(m => ({ nome: m.name, vram_mb: Math.round((m.size_vram || 0) / 1048576), total_mb: Math.round((m.size || 0) / 1048576), na_gpu: (m.size_vram || 0) > 0 })); } catch { /* ignora */ }
    }
  } catch (e) { out.erro = 'Ollama não respondeu em ' + OLLAMA; }
  if (!out.ollama) out.dica = 'Abra o Ollama (ícone na bandeja do Windows) ou rode: ollama serve';
  else if (!out.modelInstalled) out.dica = 'Baixe o modelo: ollama pull ' + MODEL;
  if (isLocal(req)) Object.assign(out, { rodando: running, esperando: waiting.length, uptime_s: Math.round((Date.now() - START) / 1000), debug: DEBUG, node: process.version });
  json(res, 200, out);
}
function handleDebug(req, res) {
  if (!isLocal(req)) return json(res, 403, { error: 'Disponível só no computador host.' });
  json(res, 200, { config: { MODEL, OLLAMA, NUM_CTX, MAX_TOKENS, RATE_PER_MIN, MAX_PARALLEL, MAX_QUEUE, ALLOWED_ORIGIN, DEBUG }, estatisticas: stats, rodando: running, esperando: waiting.length, uptime_s: Math.round((Date.now() - START) / 1000), eventos: events.slice(-50) });
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const ok = PUBLIC_FILES.has(rel) || rel.startsWith('assets/');
  const file = path.resolve(ROOT, rel);
  if (!ok || !file.startsWith(ROOT + path.sep)) { res.writeHead(404); return res.end('Não encontrado'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': rel.startsWith('assets/') ? 'public, max-age=86400' : 'no-cache' });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  if (ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  const url = new URL(req.url, 'http://x').pathname;
  if (url === '/api/chat') return req.method === 'POST' ? handleChat(req, res) : json(res, 405, { error: 'Método não permitido.' });
  if (url === '/api/health') return handleHealth(req, res);
  if (url === '/api/debug') return handleDebug(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
}).listen(PORT, HOST, () => console.log(`T.T.E. no ar: http://localhost:${PORT}  |  modelo: ${MODEL}  |  Ollama: ${OLLAMA}` + (DEBUG ? '  |  DEBUG LIGADO (logs/debug.log)' : '')));
