$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$sourcePath = Join-Path $root 'test\fixtures\visio-com-smoke.vsdx'
$previewPath = Join-Path $root '.aifde\previews\visio-com-smoke.png'

$createOutput = & pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File (Join-Path $PSScriptRoot 'new-test-vsdx.ps1') -OutputPath $sourcePath
$createJson = $createOutput | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1 | ConvertFrom-Json
if (-not $createJson.success) {
    throw "Failed to create test VSDX: $($createJson.error)"
}

$exportOutput = & pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File (Join-Path $PSScriptRoot 'export-visio.ps1') -InputPath $sourcePath -OutputPath $previewPath -Format png
$exportJson = $exportOutput | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1 | ConvertFrom-Json
if (-not $exportJson.success) {
    throw "Failed to export preview: $($exportJson.error)"
}

$previewItem = Get-Item -LiteralPath $previewPath
if ($previewItem.Length -le 0) {
    throw "Preview was created but is empty: $previewPath"
}
$outputPaths = @($exportJson.outputPaths)
foreach ($candidate in $outputPaths) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        throw "Reported preview path does not exist: $candidate"
    }
    if ((Get-Item -LiteralPath $candidate).Length -le 0) {
        throw "Reported preview path is empty: $candidate"
    }
}

@{
    success = $true
    sourcePath = $sourcePath
    previewPath = $previewPath
    outputPaths = $outputPaths
    pageCount = $exportJson.pageCount
    previewBytes = $previewItem.Length
    exportDurationMs = $exportJson.durationMs
} | ConvertTo-Json -Compress
