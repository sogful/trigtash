param(
  [Parameter(Mandatory = $true)]
  [string]$EnvironmentFile
)

$ErrorActionPreference = "Stop"

function get-commandpath([string]$name) {
  $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) { return $command.Source }
  return $null
}

function install-package([string]$id, [string]$override = "") {
  if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
    throw "Windows Package Manager is missing. Install App Installer, then rerun this build."
  }

  Write-Host "Installing $id..."
  $arguments = @(
    "install", "--id", $id, "--exact", "--silent",
    "--accept-source-agreements", "--accept-package-agreements"
  )
  if ($override) { $arguments += @("--override", $override) }
  & winget.exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "winget could not install $id (exit $LASTEXITCODE)." }
}

try {
  if (-not (get-commandpath "node") -or -not (get-commandpath "npm")) {
    install-package "OpenJS.NodeJS.LTS"
  }

  $pythonpath = get-commandpath "python"
  if (-not $pythonpath -or $pythonpath -like "$env:LOCALAPPDATA\Microsoft\WindowsApps\*") {
    install-package "Python.Python.3.12"
  }

  $cargobin = Join-Path $env:USERPROFILE ".cargo\bin"
  if (-not (get-commandpath "cargo")) {
    $rustup = Join-Path $env:TEMP "trigtash-rustup-init.exe"
    Write-Host "Installing the stable Rust toolchain..."
    Invoke-WebRequest "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe" -OutFile $rustup
    $process = Start-Process -FilePath $rustup -ArgumentList @("-y", "--default-toolchain", "stable", "--profile", "minimal") -Wait -PassThru
    Remove-Item -LiteralPath $rustup -Force -ErrorAction SilentlyContinue
    if ($process.ExitCode -ne 0) { throw "Rust installation failed (exit $($process.ExitCode))." }
  }
  if (Test-Path -LiteralPath $cargobin) { $env:Path = "$cargobin;$env:Path" }
  if (get-commandpath "rustup") {
    & rustup toolchain install stable --profile minimal
    if ($LASTEXITCODE -ne 0) { throw "Installing the stable Rust toolchain failed (exit $LASTEXITCODE)." }
  }

  $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
  $vsinstall = $null
  if (Test-Path -LiteralPath $vswhere) {
    $vsinstall = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  }
  $winsdk = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\Lib"
  if (-not $vsinstall -or -not (Test-Path -LiteralPath $winsdk)) {
    install-package "Microsoft.VisualStudio.2022.BuildTools" "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --add Microsoft.VisualStudio.Component.Windows10SDK.19041"
    if (Test-Path -LiteralPath $vswhere) {
      $vsinstall = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    }
  }
  if (-not $vsinstall) { throw "Visual C++ Build Tools were not found after setup." }
  if (-not (Test-Path -LiteralPath $winsdk)) { throw "The Windows SDK was not found after setup." }

  $webview = @(
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\EdgeWebView\Application"),
    (Join-Path $env:ProgramFiles "Microsoft\EdgeWebView\Application")
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $webview) { install-package "Microsoft.EdgeWebView2Runtime" }

  $pythonpaths = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA "Programs\Python") -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    Join-Path $_.FullName ""
    Join-Path $_.FullName "Scripts"
  }
  $pathparts = @(
    $cargobin,
    (Join-Path $env:ProgramFiles "nodejs"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer")
  ) + $pythonpaths + ($env:Path -split ";") + ([Environment]::GetEnvironmentVariable("Path", "User") -split ";") + ([Environment]::GetEnvironmentVariable("Path", "Machine") -split ";")
  $env:Path = ($pathparts | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique) -join ";"

  $vsdevcmd = Join-Path $vsinstall "Common7\Tools\VsDevCmd.bat"
  if (-not (Test-Path -LiteralPath $vsdevcmd)) { throw "Visual Studio developer environment script was not found." }
  $envline = 'set "PATH=' + $env:Path + ';%PATH%"' + "`r`n" + 'call "' + $vsdevcmd + '" -no_logo -arch=amd64 -host_arch=amd64'
  Set-Content -LiteralPath $EnvironmentFile -Value $envline -Encoding Ascii
  Write-Host "Build tools are ready."
} catch {
  Write-Error $_
  exit 1
}
