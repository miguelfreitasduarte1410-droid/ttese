@echo off
chcp 65001 >nul
title T.T.E. - diagnostico
cd /d "%~dp0"
node diagnostico.js
pause
