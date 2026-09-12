@echo off
echo ========================================================
echo Starting li.pdf AI Passport Photo Engine & Web App
echo ========================================================

start "li.pdf Photo Engine (FastAPI)" cmd /k "cd /d D:\li-pdf\photo_engine && .venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

start "li.pdf Web (Next.js)" cmd /k "cd /d D:\li-pdf\web && npm run dev"

echo Photo Engine running on http://127.0.0.1:8000
echo Web App running on http://localhost:3050
echo Opening Passport Photo Studio...
timeout /t 4 /nobreak >nul
start http://localhost:3050/passport-photo
