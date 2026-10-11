@echo off
setlocal
cd /d "%~dp0"
title DSA Grinder - Books Catalog Scanner

echo ============================================================
echo   DSA GRINDER :: BOOKS ARCHIVE SCANNER
echo ============================================================
echo.
echo Scanning oa-tracker\books folder...

if exist "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" (
    "%LOCALAPPDATA%\Python\pythoncore-3.14-64\python.exe" "%~dp0scan_books.py"
    goto done
)

where python >nul 2>nul
if %errorlevel%==0 (
    python "%~dp0scan_books.py"
    goto done
)

where py >nul 2>nul
if %errorlevel%==0 (
    py "%~dp0scan_books.py"
    goto done
)

echo Python not found. Running native PowerShell scanner...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scan_books.ps1"

:done
echo.
echo Scan finished. Books catalog updated in books_data.js.
echo Press any key to close...
pause >nul
