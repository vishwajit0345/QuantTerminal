@echo off
title QuantPortPro v5.0 Bloomberg Terminal
color 06

echo.
echo  ==========================================
echo   BLOOMBERG  QUANTPORTPRO TERMINAL v5.0
echo   Portfolio Optimization System
echo  ==========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    echo Download from https://nodejs.org (LTS version)
    pause & exit /b 1
)
echo [OK] Node.js found:
node -v

if not exist "node_modules\" (
    echo.
    echo [INFO] Installing dependencies (first time, ~45 seconds)...
    npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause & exit /b 1
    )
)
echo [OK] Dependencies ready
echo.
echo  Starting Bloomberg Terminal...
echo  Open browser at: http://localhost:5173
echo  Press Ctrl+C to stop
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"
npm run dev
