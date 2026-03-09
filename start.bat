@echo off
title WunderOnline
setlocal enabledelayedexpansion

:: ── Find Python ──────────────────────────────────────────────────────────────
set PYTHON=
for %%p in (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
) do (
    if exist %%p set PYTHON=%%~p
)
if "%PYTHON%"=="" set PYTHON=python

:: ── Get local IP ─────────────────────────────────────────────────────────────
set LOCAL_IP=localhost
for /f "usebackq tokens=2 delims=:" %%a in (`ipconfig ^| findstr /R "IPv4"`) do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo %%b | findstr /V "127.0.0.1" >nul && set LOCAL_IP=%%b
    )
)

:: ── Redis (only once) ────────────────────────────────────────────────────────
set REDIS_STARTED=0
set REDIS_EXE=
for %%r in (
    "D:\Redis\redis-server.exe"
    "%PROGRAMFILES%\Redis\redis-server.exe"
    "%PROGRAMFILES(X86)%\Redis\redis-server.exe"
    "%LOCALAPPDATA%\Redis\redis-server.exe"
    "C:\Redis\redis-server.exe"
) do (
    if exist %%r set REDIS_EXE=%%~r
)

tasklist /FI "WINDOWTITLE eq WunderRedis" 2>nul | findstr /I "cmd.exe" >nul
if %ERRORLEVEL% neq 0 (
    if not "%REDIS_EXE%"=="" (
        start "WunderRedis" /min cmd /c ""%REDIS_EXE%""
        set REDIS_STARTED=1
    ) else (
        where redis-server >nul 2>&1
        if !ERRORLEVEL!==0 (
            start "WunderRedis" /min cmd /c "redis-server"
            set REDIS_STARTED=1
        ) else (
            where docker >nul 2>&1
            if !ERRORLEVEL!==0 (
                docker start wunder-redis >nul 2>&1
                if !ERRORLEVEL! neq 0 docker run -d --name wunder-redis -p 6379:6379 redis:alpine >nul 2>&1
                set REDIS_STARTED=1
            )
        )
    )
)

:: ════════════════════════════════════════════════════════════════════════════
:restart_servers
cls
echo ========================================
echo        WunderOnline
echo ========================================
echo.

:: Kill running servers (in case of restart)
taskkill /F /FI "WINDOWTITLE eq WunderBackend"  >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq WunderFrontend" >nul 2>&1
timeout /t 1 /nobreak >nul

:: ── Backend ──────────────────────────────────────────────────────────────────
echo [1/2] Starting backend (Django + Daphne)...
cd /d "%~dp0backend"
start "WunderBackend" /min cmd /c ""%PYTHON%" -m daphne -b 0.0.0.0 -p 8000 config.asgi:application"

:: ── Frontend ─────────────────────────────────────────────────────────────────
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
echo   ENTER = Restart   |   Q+ENTER = Quit
echo ========================================

set /p "KEY=  > "
if /i "%KEY%"=="q" goto :stop_all
goto :restart_servers

:: ════════════════════════════════════════════════════════════════════════════
:stop_all
taskkill /F /FI "WINDOWTITLE eq WunderBackend"  >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq WunderFrontend" >nul 2>&1
if %REDIS_STARTED%==1 taskkill /F /FI "WINDOWTITLE eq WunderRedis" >nul 2>&1
if %REDIS_STARTED%==1 docker stop wunder-redis >nul 2>&1
echo.
echo Servers stopped.
timeout /t 2 /nobreak >nul
