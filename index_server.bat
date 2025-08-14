@echo off
REM =================================================================
REM  Simple Python Web Server Launcher for a Web Game
REM =================================================================
ECHO Starting Python web server...

REM Use a specific port, e.g., 8000
set PORT=8000

REM Check for Python 3
python --version >nul 2>nul
if %errorlevel% == 0 (
    ECHO Found Python 3.
    start python -m http.server %PORT%
) else (
    REM Check for Python 2
    py --version >nul 2>nul
    if %errorlevel% == 0 (
        ECHO Found Python 2.
        start python -m SimpleHTTPServer %PORT%
    ) else (
        ECHO ERROR: Python is not found in your system's PATH.
        ECHO Please install Python or add it to your PATH environment variable.
        pause
        exit /b
    )
)

ECHO Server is starting in a new window.
ECHO Opening the game in your default browser...
timeout /t 2 /nobreak >nul

REM Open the URL in the default browser
start http://localhost:%PORT%

ECHO Done. You can close this window.