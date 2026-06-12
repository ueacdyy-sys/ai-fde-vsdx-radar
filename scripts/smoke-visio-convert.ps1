$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$legacyPath = Join-Path $root 'test\fixtures\visio-com-legacy-smoke.vsd'
$convertedPath = Join-Path $root 'test\fixtures\visio-com-legacy-smoke.converted.vsdx'

$createOutput = & pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File (Join-Path $PSScriptRoot 'new-test-vsdx.ps1') -OutputPath $legacyPath
$createJson = $createOutput | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1 | ConvertFrom-Json
if (-not $createJson.success) {
    throw "Failed to create legacy test VSD: $($createJson.error)"
}

if (Test-Path -LiteralPath $convertedPath) {
    Remove-Item -LiteralPath $convertedPath -Force
}

$convertOutput = & pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File (Join-Path $PSScriptRoot 'convert-visio-to-modern-package.ps1') -InputPath $legacyPath -OutputPath $convertedPath
$convertJson = $convertOutput | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1 | ConvertFrom-Json
if (-not $convertJson.success) {
    throw "Failed to convert legacy Visio file: $($convertJson.error)"
}

$convertedItem = Get-Item -LiteralPath $convertedPath
if ($convertedItem.Length -le 0) {
    throw "Converted package was created but is empty: $convertedPath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($convertedPath)
try {
    $pageEntries = @($zip.Entries | Where-Object { $_.FullName -match '^visio/pages/page\d+\.xml$' })
    if ($pageEntries.Count -lt 1) {
        throw "Converted package does not contain visio/pages/page*.xml"
    }
}
finally {
    $zip.Dispose()
}

@{
    success = $true
    legacyPath = $legacyPath
    convertedPath = $convertedPath
    outputFormat = $convertJson.outputFormat
    pageCount = $convertJson.pageCount
    convertedBytes = $convertedItem.Length
    convertDurationMs = $convertJson.durationMs
} | ConvertTo-Json -Compress
