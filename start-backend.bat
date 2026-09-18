@echo off
title Factory Calculator - Backend
cd /d "%~dp0backend"
echo.
echo  ========================================
echo   Factory Calculator Backend
echo   http://localhost:3000
echo  ========================================
echo.
node node_modules\tsx\dist\cli.mjs src/server.ts
pause
