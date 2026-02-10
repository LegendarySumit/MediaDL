@echo off
REM ==============================================
REM Production Deployment Script (Windows)
REM ==============================================

echo ========================================
echo Media Downloader - Production Deploy
echo ========================================
echo.

REM Check if .env exists
if not exist "backend\.env" (
    echo Error: backend\.env not found
    echo Copy .env.production to backend\.env and configure it:
    echo   copy .env.production backend\.env
    echo   notepad backend\.env
    pause
    exit /b 1
)

echo Running pre-deployment checks...

REM Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker not installed
    echo Download from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo [OK] Docker installed

REM Check Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker Compose not installed
    pause
    exit /b 1
)
echo [OK] Docker Compose installed

echo.
echo Building Docker images...
docker-compose -f docker-compose.prod.yml build --no-cache

echo.
echo Starting services...
docker-compose -f docker-compose.prod.yml up -d

echo.
echo Waiting for services to be healthy...
timeout /t 10 /nobreak >nul

echo.
echo Checking service status...
docker-compose -f docker-compose.prod.yml ps

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Your application is running!
echo.
echo Next steps:
echo   1. Set up SSL on your Linux server (Windows doesn't support Let's Encrypt directly)
echo   2. View logs: docker-compose -f docker-compose.prod.yml logs -f
echo   3. Access locally: http://localhost
echo.
echo Management commands:
echo   Stop:    docker-compose -f docker-compose.prod.yml down
echo   Restart: docker-compose -f docker-compose.prod.yml restart
echo   Logs:    docker-compose -f docker-compose.prod.yml logs -f
echo.
pause
