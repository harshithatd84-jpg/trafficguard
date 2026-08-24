@echo off
title TrafficGuard AI
color 0A
echo.
echo  ████████╗██████╗  █████╗ ███████╗███████╗██╗ ██████╗
echo  ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝██║██╔════╝
echo     ██║   ██████╔╝███████║█████╗  █████╗  ██║██║
echo     ██║   ██╔══██╗██╔══██║██╔══╝  ██╔══╝  ██║██║
echo     ██║   ██║  ██║██║  ██║██║     ██║     ██║╚██████╗
echo     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝     ╚═╝ ╚═════╝
echo                    GUARD AI v2.0
echo.
echo  Starting Flask server...
echo  Open frontend/index.html in your browser after this starts.
echo.
cd /d "%~dp0"
python app.py
pause
