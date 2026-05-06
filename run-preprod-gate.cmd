@echo off
setlocal
cd /d "%~dp0"

echo.
echo Pellichupulu Pre-Production Gate
echo ================================
echo Runs staging deploy + schema + seed + smoke scenarios.
echo A report is written under outputs\preprod-gate-report-*.md
echo.

node .\scripts\preprod-gate.mjs
if errorlevel 1 goto failed

echo.
echo Pre-production gate passed.
pause
exit /b 0

:failed
echo.
echo Pre-production gate failed. Check output and report file.
pause
exit /b 1
