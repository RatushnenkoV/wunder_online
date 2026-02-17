@echo off
title WunderOnline

echo ========================================
echo        WunderOnline - Start
echo ========================================
echo.

:: Find working Python
set PYTHON=
for %%p in (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
) do (
    if exist %%p set PYTHON=%%~p
)
if "%PYTHON%"=="" set PYTHON=python

:: Get local IP
set LOCAL_IP=localhost
for /f "usebackq tokens=2 delims=:" %%a in (`ipconfig ^| findstr /R "IPv4"`) do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo %%b | findstr /V "127.0.0.1" >nul && set LOCAL_IP=%%b
    )
)

echo [1/2] Starting backend (Django)...
cd /d "%~dp0backend"
start "WunderBackend" /min cmd /c ""%PYTHON%" manage.py runserver 0.0.0.0:8000"

echo [2/2] Starting frontend (Vite)...
cd /d "%~dp0frontend"
start "WunderFrontend" /min cmd /c "npm run dev -- --host 0.0.0.0"

echo.
echo Waiting for servers...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo        Servers are running!
echo ========================================
echo.
echo  Frontend:  http://%LOCAL_IP%:5173
echo  Backend:   http://%LOCAL_IP%:8000
echo  Admin:     http://%LOCAL_IP%:8000/admin
echo.
echo  Local:     http://localhost:5173
echo.
echo ========================================
echo  Press any key to stop servers...
echo ========================================
pause >nul

taskkill /F /FI "WINDOWTITLE eq WunderBackend" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq WunderFrontend" >nul 2>&1
echo Servers stopped.
timeout /t 2 >nul
