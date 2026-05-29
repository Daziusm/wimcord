# Runs after the Wimcord Installer GUI exits so Electron does not lock Discord's app.asar.
param(
    [int]$ParentPid,
    [string]$CliPath,
    [string]$CliArgsJson,
    [string]$WimcordRoot,
    [string]$StateDir,
    [string]$ResultPath,
    [string]$InstallerExe,
    [string]$Action,
    [string]$RestartDiscord,
    [string]$UpdateExe,
    [string]$ProcessName
)

$ErrorActionPreference = "Continue"
$handoffLog = Join-Path $StateDir "handoff.log"

function Log($msg) {
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
    Add-Content -Path $handoffLog -Value $line -Encoding utf8
}

Log "handoff started (parent PID $ParentPid)"

while (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) {
    Start-Sleep -Milliseconds 300
}
Log "parent exited — waiting for file handles"
Start-Sleep -Seconds 4

$env:VENCORD_USER_DATA_DIR = $WimcordRoot
$env:WIMCORD_ROOT = $WimcordRoot
$env:VENCORD_DEV_INSTALL = "1"
$env:WIMCORD_INSTALLER_STATE_DIR = $StateDir

$cliArgs = @($CliArgsJson | ConvertFrom-Json)
$logFile = Join-Path $StateDir "installer-last-run.log"

Log "running: $CliPath $($cliArgs -join ' ')"
"" | Set-Content -Path $logFile -Encoding utf8
& $CliPath @cliArgs *>&1 | Tee-Object -FilePath $logFile -Append
$code = $LASTEXITCODE
Log "CLI exit code $code"
$log = Get-Content -Path $logFile -Raw -ErrorAction SilentlyContinue

$ok = $code -eq 0
$message = if ($ok) {
    switch ($Action) {
        "install" { "Wimcord installed successfully" }
        "uninstall" { "Wimcord uninstalled successfully" }
        "repair" { "Repair completed successfully" }
        default { "Operation completed successfully" }
    }
} else {
    "Installer exited with code $code"
}

@{
    ok           = $ok
    action       = $Action
    message      = $message
    error        = if ($ok) { $null } else { $message }
    log          = $log
    pending      = $false
    finishedAt   = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
} | ConvertTo-Json -Compress | Set-Content -Path $ResultPath -Encoding utf8

if ($ok -and $RestartDiscord -eq "1" -and $UpdateExe -and (Test-Path $UpdateExe)) {
    Start-Process -FilePath $UpdateExe -ArgumentList "--processStart", $ProcessName
}

$installerDir = Split-Path -Parent $InstallerExe
$env:WIMCORD_INSTALLER_PACKAGED = "1"
$env:WIMCORD_INSTALLER_RESULT = "1"
Log "reopening installer: $InstallerExe"
Start-Process -FilePath $InstallerExe -WorkingDirectory $installerDir
Log "handoff finished"
