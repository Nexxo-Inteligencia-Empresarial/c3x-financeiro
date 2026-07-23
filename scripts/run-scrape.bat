@echo off
title C3X Financeiro - Atualizando dados
cd /d "%~dp0"

echo.
echo  ===================================
echo   C3X Financeiro - Scraper Local
echo  ===================================
echo.

node refresh-via-playwright.js

if %errorlevel% == 2 (
  echo.
  echo  [INFO] Edge estava aberto. Use o bookmarklet:
  echo.
  echo  1. Acesse empresa.nibo.com.br no Edge
  echo  2. Clique no favorito "C3X Atualizar"
  echo.
  echo  Ou feche o Edge e execute este script novamente.
  echo.
  pause
  exit /b 2
)

if %errorlevel% neq 0 (
  echo.
  echo  [FALHOU] Verifique os erros acima.
  pause
  exit /b 1
)

echo  Concluido!
timeout /t 3 >nul
