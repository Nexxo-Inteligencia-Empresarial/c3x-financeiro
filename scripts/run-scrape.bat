@echo off
title C3X Financeiro - Atualizando dados
cd /d "%~dp0"

echo.
echo  ===================================
echo   C3X Financeiro - Scraper Local
echo  ===================================
echo.

node refresh-and-scrape.js

if %errorlevel% neq 0 (
  echo.
  echo  [FALHOU] Verifique os erros acima.
  echo  Dica: confira se o .env.local esta correto.
  echo.
  pause
  exit /b 1
)

echo  Pressione qualquer tecla para fechar...
timeout /t 5 >nul
