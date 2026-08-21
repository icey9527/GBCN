@echo off
rem QB Wiki mirror launcher - pure ASCII to avoid cmd codepage bugs
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 goto :runpy
where py >nul 2>nul
if %errorlevel%==0 goto :runpyp
echo [ERROR] Python not found. Please install Python first.
pause
exit /b 1

:runpy
start "" http://localhost:8420
echo QB Wiki mirror: http://localhost:8420
echo (close this window to stop the server)
python -m http.server 8420
goto :end

:runpyp
start "" http://localhost:8420
echo QB Wiki mirror: http://localhost:8420
echo (close this window to stop the server)
py -m http.server 8420

:end
echo Server stopped.
pause
