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

:: ── Redis ───────────────────────────────────────────────────────────────────
echo [0/3] Starting Redis...
set REDIS_STARTED=0

:: 1. Попытка — redis-server.exe в PATH или стандартных местах
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

if not "%REDIS_EXE%"=="" (
    start "WunderRedis" /min cmd /c ""%REDIS_EXE%""
    set REDIS_STARTED=1
    echo   Redis запущен: %REDIS_EXE%
    goto redis_done
)

:: 2. Попытка — redis-server в PATH (WSL/Chocolatey/Scoop)
where redis-server >nul 2>&1
if %ERRORLEVEL%==0 (
    start "WunderRedis" /min cmd /c "redis-server"
    set REDIS_STARTED=1
    echo   Redis запущен из PATH.
    goto redis_done
)

:: 3. Попытка — Docker
where docker >nul 2>&1
if %ERRORLEVEL%==0 (
    echo   redis-server не найден, пробую Docker...
    docker start wunder-redis >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        docker run -d --name wunder-redis -p 6379:6379 redis:alpine >nul 2>&1
    )
    if %ERRORLEVEL%==0 (
        set REDIS_STARTED=1
        echo   Redis запущен через Docker.
        goto redis_done
    )
)

:: Ничего не найдено
echo   [ВНИМАНИЕ] Redis не найден! Группы (WebSocket) не будут работать.
echo   Установи Redis: docker run -p 6379:6379 redis
echo.

:redis_done

:: ── Backend ──────────────────────────────────────────────────────────────────
echo [1/3] Starting backend (Django + Daphne ASGI)...
cd /d "%~dp0backend"
start "WunderBackend" /min cmd /c ""%PYTHON%" -m daphne -b 0.0.0.0 -p 8000 config.asgi:application"

:: ── Frontend ─────────────────────────────────────────────────────────────────
echo [2/3] Starting frontend (Vite)...
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
if %REDIS_STARTED%==1 taskkill /F /FI "WINDOWTITLE eq WunderRedis" >nul 2>&1
if %REDIS_STARTED%==1 docker stop wunder-redis >nul 2>&1
echo Servers stopped.
timeout /t 2 >nul
