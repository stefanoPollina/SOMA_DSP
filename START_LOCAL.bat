@echo off
cd /d "%~dp0"
start "Somatic Local Server" cmd /k "py -3 -m http.server 8000 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/"
