param(
  [Parameter(Mandatory = $true)][string]$Lnk,
  [Parameter(Mandatory = $true)][string]$Target
)
$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut($Lnk)
$s.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
$s.Arguments = '"' + $Target + '"'
$s.Description = 'save data (webview2 localStorage)'
$s.IconLocation = 'imageres.dll,3'
$s.Save()
