@echo off
chcp 65001 >nul
title T.T.E. - iniciar
cd /d "%~dp0"
rem Modelo da IA. Se sua 3060 tiver so 8 GB, troque por: llama3.1:8b
set OLLAMA_MODEL=gemma3:12b
where node >nul 2>nul || (echo Instale o Node.js LTS: https://nodejs.org & pause & exit /b)
where ollama >nul 2>nul || (echo Instale o Ollama: https://ollama.com/download & pause & exit /b)
echo Verificando o modelo %OLLAMA_MODEL% (baixa so na primeira vez)...
ollama pull %OLLAMA_MODEL%
start "Servidor T.T.E." cmd /k node server.js
where cloudflared >nul 2>nul && (start "Link publico T.T.E." cmd /k cloudflared tunnel --url http://localhost:3000) || echo cloudflared nao instalado: o site abre so neste PC.
echo.
echo Pronto! Neste PC: http://localhost:3000
echo O link publico aparece na janela "Link publico" (termina em trycloudflare.com).
pause
