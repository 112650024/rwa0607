@echo off
title FormosaX Oracle Feeder - keep this window open
cd /d "%~dp0"
echo ============================================================
echo   FormosaX - TWD Stock Price Oracle Feeder
echo   Pushes TWSE prices to the Sepolia oracle every 10 minutes.
echo   Auto-restarts if it stops. Close this window to quit.
echo   Live site refreshes automatically: rwa0607.vercel.app
echo ============================================================
echo.
:loop
echo [%date% %time%] feeding TWSE prices to Sepolia oracle...
node scripts\feeder.js
echo.
echo [%date% %time%] feeder stopped. Restarting in 10s. Press Ctrl+C to quit.
timeout /t 10 /nobreak >nul
goto loop
