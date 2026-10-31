# T.T.E. — site com J.A.R.V.I.S. em IA local (versão 2, com debug)

O site roda no **seu PC**, a IA roda na **sua placa de vídeo** (sem cota, sem cobrança) e o link público é grátis via Cloudflare.

## ⚠️ Antes de tudo: extraia o zip
**Não abra o `index.html` de dentro do .zip.** O Windows extrai só aquele arquivo e deixa a pasta `assets/` (fotos) para trás — o site abre sem imagens. Clique com o botão direito no zip → **Extrair tudo**, e abra os arquivos da pasta extraída. O jeito certo é dar dois cliques em `iniciar.bat` e usar http://localhost:3000.
(Se isso acontecer, o próprio site mostra um aviso amarelo explicando.)

## 1. Instalar (uma vez só)
1. **Node.js LTS** — https://nodejs.org
2. **Ollama** — https://ollama.com/download (fica em segundo plano)
3. **cloudflared** (link público grátis) — no PowerShell: `winget install Cloudflare.cloudflared`

## 2. Usar
| Arquivo | Para quê |
|---|---|
| `diagnostico.bat` | **Rode primeiro.** Confere programas, arquivos, Ollama, modelo, se a IA está na placa de vídeo e se o servidor está no ar. Diz o que fazer em cada falha. |
| `iniciar.bat` | Liga tudo (baixa o modelo na 1ª vez, ~8 GB). |
| `iniciar-debug.bat` | Igual, mas com logs detalhados na janela e em `logs/debug.log`. |

Endereço no seu PC: http://localhost:3000 · Para os outros: o `https://….trycloudflare.com` da janela "Link publico".

## 3. Modo debug (invisível para visitantes)
- **No site:** abra qualquer página com `?debug=1` (ex.: `http://localhost:3000/?debug=1`), ou aperte **Ctrl+Alt+D**, ou digite `/debug` no chat. Desligar: `?debug=0` ou o ✕ do painel.
- O painel mostra: erros de JavaScript, imagens/recursos que não carregaram, chamadas de rede com tempo, saúde da IA e um botão **Testar resposta** (mede o tempo até a 1ª palavra).
- **Copiar relatório** gera um texto com tudo — é só colar numa conversa para pedir ajuda.
- **No servidor:** `http://localhost:3000/api/debug` (só abre no PC host) mostra estatísticas e os últimos eventos; `/api/health` mostra se o modelo está na GPU.

## 4. Limites (honestidade)
- O PC precisa ficar ligado com as duas janelas abertas; desligou, o chat mostra uma resposta resumida no lugar da IA.
- O link grátis muda toda vez que reinicia; link fixo exige domínio no Cloudflare. Sem garantia de disponibilidade no modo grátis.
- "Ilimitado" = sem cota de tokens; a velocidade é a da sua placa. O servidor atende 2 por vez (fila de 8) e limita 20 perguntas/min por visitante.

## 5. Ajustes (variáveis de ambiente)
`OLLAMA_MODEL` (padrão `gemma3:12b`; com 8 GB de VRAM use `llama3.1:8b`), `MAX_PARALLEL`, `RATE_PER_MIN`, `MAX_TOKENS`, `PORT`, `DEBUG=1`.

## 6. Site em outro lugar (opcional)
Páginas no GitHub Pages/Cloudflare Pages + só a IA no seu PC: em `config.js` ponha `window.TTE_API_URL = 'https://SEU-LINK.trycloudflare.com'` e inicie com `ALLOWED_ORIGIN=https://seu-site.github.io`.
