@echo off
cd /d "%~dp0"
echo MicroScope 3D - Arduino Uno R3
where node >nul 2>nul || (echo Node.js is not installed. Install Node.js 20 or newer.& pause & exit /b 1)
if not exist node_modules (
  echo Installing project dependencies...
  call npm.cmd install
  if errorlevel 1 (echo Dependency installation failed.& pause & exit /b 1)
)
echo Starting local dashboard...
call npm.cmd run dev
pause
