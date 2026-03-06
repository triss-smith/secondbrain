@echo off
echo Starting Second Brain...

:: Backend
start "Backend" cmd /k "cd /d %~dp0 && uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

:: Frontend
start "Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo To access from your phone, use your machine's local IP address.
echo Find it with: ipconfig
pause
