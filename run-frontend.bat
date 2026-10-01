@echo off
title Crisis Command - Frontend
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
)
echo Starting Vite Frontend Dev Server on http://localhost:5173 ...
call npm run dev
pause
