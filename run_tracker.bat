@echo off
setlocal
cd /d "%~dp0"
title DSA Grinder - Virtual Contest Tracker

echo Scanning books repository...
if exist "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" (
    "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" "%~dp0scan_books.py" >nul 2>nul
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        python "%~dp0scan_books.py" >nul 2>nul
    ) else (
        where py >nul 2>nul
        if %errorlevel%==0 (
            py "%~dp0scan_books.py" >nul 2>nul
        ) else (
            powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scan_books.ps1" >nul 2>nul
        )
    )
)

echo Launching DSA Grinder in default browser...
start "" "%~dp0index.html"
exit
