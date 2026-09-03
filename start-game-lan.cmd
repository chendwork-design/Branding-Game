@echo off
setlocal
cd /d "%~dp0"
set HOST=0.0.0.0
set CORS_ORIGINS=*
set WEB_PORT=4180
set V11_API_PORT=3002
set "DIST_DIR=%~dp0.vite-cache\web-dist"

echo Building the v1.2 student preview and API runtime...
call pnpm release:build
if errorlevel 1 (
  echo Build failed. The LAN preview was not started.
  exit /b 1
)

for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4"') do if not defined LAN_IP set "LAN_IP=%%A"
set LAN_IP=%LAN_IP: =%
if not defined LAN_IP set LAN_IP=127.0.0.1

start "Laojie Brand Game v1.2 API" /D "%~dp0" "%ComSpec%" /k "set NODE_ENV=development&& set HOST=0.0.0.0&& set V11_API_PORT=%V11_API_PORT%&& set DEV_V11_TRIAL_CLASS_CODE=LAOJIE11&& set CORS_ORIGINS=*&& node apps/api/dist/apps/api/src/v11-server.js"
start "Laojie Brand Game v1.2 Web" /D "%~dp0" "%ComSpec%" /k "set HOST=0.0.0.0&& set PORT=%WEB_PORT%&& set DIST_DIR=%DIST_DIR%&& set API_PORT=3000&& set V11_API_PORT=%V11_API_PORT%&& node apps/web/static-server.mjs"

set "SERVICES_READY=0"
for /l %%N in (1,1,40) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$apiOk=$false; $webOk=$false; try { $api=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3002/ready' -TimeoutSec 2; $apiOk=$api.StatusCode -eq 200 } catch {}; try { $web=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4180/v11' -TimeoutSec 2; $webOk=$web.StatusCode -eq 200 } catch {}; if (-not ($apiOk -and $webOk)) { exit 1 }"
  if not errorlevel 1 (
    set "SERVICES_READY=1"
    goto services_ready
  )
  >nul timeout /t 1 /nobreak
)

:services_ready
echo.
if "%SERVICES_READY%"=="0" (
  echo Services did not become ready within 40 seconds. Check the two server windows before sharing the link.
) else (
  echo API and web preview are ready.
)
echo Student preview: http://%LAN_IP%:%WEB_PORT%/v11
echo Class code: LAOJIE11
echo Keep the two server windows open while students are playing.
pause
