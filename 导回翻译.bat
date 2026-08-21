@echo off
rem QB Wiki translation importer (apply translations.json back to pages)
rem pure ASCII to avoid cmd codepage bugs
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 goto :runpy
where py >nul 2>nul
if %errorlevel%==0 goto :runpyp
echo [ERROR] Python not found. Please install Python first.
pause
exit /b 1

:runpy
python tools\tl_pipeline.py apply
goto :end

:runpyp
py tools\tl_pipeline.py apply

:end
pause
