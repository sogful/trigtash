@echo off
setlocal enabledelayedexpansion
set "ROOT=%~dp0"
set "TAURI=%ROOT%dependencies\tauri"
set "ST=%TAURI%\src-tauri"
set "SIDECAR=%ST%\binaries\ffmpeg.exe"
set "OUT=%ROOT%game"
set "GDEXP=%ROOT%dependencies\gdexporter"
set "STAGE=%TEMP%\tgd-export"
set "EXPORTSRC=%STAGE%\app"
set "GAMEDIR=%OUT%\game"

echo ~ trigtash builder!! ~

where cargo >nul 2>&1 || ( echo [error] rust/cargo not on PATH & exit /b 1 )
where npm   >nul 2>&1 || ( echo [error] npm not on PATH & exit /b 1 )

if not exist "%TAURI%\node_modules" (
  echo installing tauri cli..
  pushd "%TAURI%"
  call npm install
  set "ERR=!errorlevel!"
  popd
  if not "!ERR!"=="0" ( echo [error] npm install failed & exit /b 1 )
)

if not exist "%ST%\icons\icon.ico" (
  echo generating app icons..
  pushd "%TAURI%"
  call npx tauri icon "%ROOT%project\icons\desktop-icon-512.png"
  popd
)

if not exist "%SIDECAR%" (
  set "FFSRC="
  for %%P in ("%ROOT%dependencies\ffmpeg\bin\ffmpeg.exe") do (
    if exist "%%~P" if not defined FFSRC set "FFSRC=%%~P"
  )
  if defined FFSRC (
    echo staging sidecar from !FFSRC!
    if not exist "%ST%\binaries" mkdir "%ST%\binaries"
    copy /Y "!FFSRC!" "%SIDECAR%" >nul
  ) else (
    echo ffmpeg.exe not found - building without the recorder sidecar
  )
)

if not exist "%GDEXP%\node_modules\gdcore-tools\src\index.mjs" (
  echo installing gdevelop 5.6 core..
  pushd "%GDEXP%"
  call npm install
  set "ERR=!errorlevel!"
  popd
  if not "!ERR!"=="0" ( echo gdcore-tools install failed & exit /b 1 )
)

echo reinjecting feature scripts..
for %%S in (tas\~build.js settings\~build.js demonlist\~build.js mappack\~build.js portal\~build.js rated\~build.js leveldeco\build.js blackorb\~build.js lowdetail\~build.js) do (
  call node "%ROOT%scripts\%%S" >nul
  if not "!errorlevel!"=="0" ( echo inject failed: %%S & exit /b 1 )
)

echo packaging project\Geomangle.json ..
pushd "%GDEXP%"
call node run.mjs "%STAGE%"
set "ERR=!errorlevel!"
popd
if not "!ERR!"=="0" ( echo gdevelop export failed & exit /b 1 )

if not exist "%EXPORTSRC%\index.html" (
  echo export did not produce "%EXPORTSRC%\index.html"
  exit /b 1
)
echo building.. this might take a long time
pushd "%TAURI%"
call npx tauri build --no-bundle
set "ERR=!errorlevel!"
popd
if not "!ERR!"=="0" ( echo tauri build failed & exit /b 1 )

if not exist "%OUT%" mkdir "%OUT%"
copy /Y "%ST%\target\release\trigonometry-dash.exe" "%OUT%\Trigonometry Dash.exe" >nul
if exist "%SIDECAR%" copy /Y "%SIDECAR%" "%OUT%\ffmpeg.exe" >nul

echo placing external game files (the ones in \game\game)
robocopy "%EXPORTSRC%" "%GAMEDIR%" /MIR /NFL /NDL /NJH /NJS /NP /R:1 /W:1 >nul
if errorlevel 8 ( echo game files copy failed & exit /b 1 )

if "%TGD_COMPRESSED%"=="1" (
  echo swapping in compressed audio..
  call node "%ROOT%scripts\audio\swapcompressed.js" "%GAMEDIR%"
  if not "!errorlevel!"=="0" ( echo compressed audio swap failed & exit /b 1 )
) else (
  echo shipping compressed music copy..
  call node "%ROOT%scripts\audio\~buildaltaudio.js" "%GAMEDIR%"
  if not "!errorlevel!"=="0" ( echo alt audio copy failed & exit /b 1 )
)

echo restructuring assets into project folders..
call node "%ROOT%scripts\~build.js" "%GAMEDIR%"
if not "!errorlevel!"=="0" ( echo asset restructure failed & exit /b 1 )

rd /s /q "%STAGE%" 2>nul

echo.
echo ~ done! see "%OUT%" ~
if not "%TGD_NOLAUNCH%"=="1" start "" "%OUT%\Trigonometry Dash.exe"
endlocal