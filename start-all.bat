@echo off
title Crisis Command - Launcher
echo ============================================================
echo           🚨 CRISIS COMMAND - STARTUP LAUNCHER 🚨
echo ============================================================
echo.

REM Optional: Start Docker MongoDB if docker is running
where docker >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting MongoDB via Docker Compose (if needed)...
    docker compose up -d mongo
) else (
    echo Note: Docker not detected in PATH. Ensure local MongoDB is running at mongodb://localhost:27017 if persistence is required.
)

echo.
echo Launching Backend in a new terminal...
start "Crisis Command - Backend" cmd /k "%~dp0run-backend.bat"

echo Launching Frontend in a new terminal...
start "Crisis Command - Frontend" cmd /k "%~dp0run-frontend.bat"

echo.
echo ============================================================
echo Applications starting:
echo  - Backend:  http://localhost:8000 (API Docs: http://localhost:8000/docs)
echo  - Frontend: http://localhost:5173
echo ============================================================
echo.
