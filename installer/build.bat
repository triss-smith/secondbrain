@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."

echo === Second Brain Windows Installer Build ===
echo.

:: ── 1. Build frontend ────────────────────────────────────────────────────────
echo [1/4] Building frontend...
cd frontend
call npm run build
if errorlevel 1 (echo ERROR: Frontend build failed. && exit /b 1)
cd ..
echo     Done.
echo.

:: ── 2. Set up embedded Python ────────────────────────────────────────────────
set PYTHON_VERSION=3.12.9
set PYTHON_ZIP=python-%PYTHON_VERSION%-embed-amd64.zip
set PYTHON_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/%PYTHON_ZIP%
set EMBED_DIR=installer\python-embed

echo [2/4] Setting up embedded Python %PYTHON_VERSION%...
if exist "%EMBED_DIR%\python.exe" (
    echo     Already set up, skipping.
) else (
    :: Download if not cached
    if not exist "installer\%PYTHON_ZIP%" (
        echo     Downloading %PYTHON_URL%...
        powershell -Command "Invoke-WebRequest -Uri '%PYTHON_URL%' -OutFile 'installer\%PYTHON_ZIP%'"
        if errorlevel 1 (echo ERROR: Download failed. && exit /b 1)
    )

    :: Extract
    echo     Extracting...
    powershell -Command "Expand-Archive -Path 'installer\%PYTHON_ZIP%' -DestinationPath '%EMBED_DIR%' -Force"

    :: Enable site-packages (required for pip to work)
    powershell -Command "(Get-Content 'installer\python-embed\python312._pth') -replace '#import site', 'import site' | Set-Content 'installer\python-embed\python312._pth'"

    :: Install pip into embedded Python
    echo     Installing pip...
    powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'installer\get-pip.py'"
    installer\python-embed\python.exe installer\get-pip.py --no-warn-script-location
    if errorlevel 1 (echo ERROR: pip install failed. && exit /b 1)
)

:: Install dependencies into embedded Python (done once at build time, not at install time)
echo     Installing dependencies into embedded Python...
installer\python-embed\python.exe -m pip install -r requirements.txt --target installer\python-embed\Lib\site-packages --no-warn-script-location
if errorlevel 1 (echo ERROR: Dependency install failed. && exit /b 1)
echo     Done.
echo.

:: ── 3. Create output directory ───────────────────────────────────────────────
if not exist dist mkdir dist

:: ── 4. Compile installer ─────────────────────────────────────────────────────
echo [3/4] Compiling installer with Inno Setup...
set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist %ISCC% (
    echo ERROR: Inno Setup 6 not found at %ISCC%.
    echo Download from: https://jrsoftware.org/isdl.php
    exit /b 1
)
%ISCC% installer\SecondBrain.iss
if errorlevel 1 (echo ERROR: Inno Setup compilation failed. && exit /b 1)
echo     Done.
echo.

:: ── 5. Sign installer (if certificate exists) ───────────────────────────────
set PFX=installer\SecondBrain.pfx
if exist "%PFX%" (
    echo [4/4] Signing installer...

    :: Find signtool.exe in Windows SDK
    set SIGNTOOL=
    for /f "delims=" %%i in ('where signtool 2^>nul') do set SIGNTOOL=%%i
    if not defined SIGNTOOL (
        for /r "C:\Program Files (x86)\Windows Kits\10\bin" %%i in (signtool.exe) do set SIGNTOOL=%%i
    )
    if not defined SIGNTOOL (
        for /r "C:\Program Files\Windows Kits\10\bin" %%i in (signtool.exe) do set SIGNTOOL=%%i
    )

    if not defined SIGNTOOL (
        echo     WARNING: signtool.exe not found. Skipping signing.
        echo     Install the Windows SDK to enable signing:
        echo     https://developer.microsoft.com/windows/downloads/windows-sdk/
    ) else (
        set /p PFX_PASS=Enter certificate password:
        "%SIGNTOOL%" sign /f "%PFX%" /p "%PFX_PASS%" /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 "dist\SecondBrain-Setup.exe"
        if errorlevel 1 (echo ERROR: Signing failed. && exit /b 1)
        echo     Done.
    )
) else (
    echo [4/4] No certificate found, skipping signing.
    echo     Run: powershell -ExecutionPolicy Bypass -File installer\create-cert.ps1
)
echo.

echo Build complete!
echo     Output: dist\SecondBrain-Setup.exe
echo.
pause
