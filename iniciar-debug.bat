@echo off
chcp 65001 >nul
title T.T.E. - iniciar (DEBUG)
cd /d "%~dp0"
set DEBUG=1
call iniciar.bat
