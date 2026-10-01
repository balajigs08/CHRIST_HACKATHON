@echo off
title Crisis Command - Backend
cd /d "%~dp0backend"
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)
echo Activating virtual environment...
call .venv\Scripts\activate.bat
echo Installing/Verifying dependencies...
pip install -r requirements.txt
echo Starting FastAPI Backend Server on http://localhost:8000 ...
python -m uvicorn main:app --reload --port 8000
pause
