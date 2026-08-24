@echo off
title TrafficGuard AI - First Time Setup
color 0B
echo.
echo ╔══════════════════════════════════════╗
echo ║  TrafficGuard AI - First Time Setup  ║
echo ╚══════════════════════════════════════╝
echo.
echo This will install dependencies, generate data and train models.
echo It may take 2-3 minutes. Please wait...
echo.
cd /d "%~dp0"
python setup.py
echo.
echo ════════════════════════════════════════
echo  Now starting the server...
echo  Open frontend/index.html in browser!
echo ════════════════════════════════════════
echo.
python app.py
pause
