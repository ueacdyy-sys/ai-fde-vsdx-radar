$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$sourcePath = Join-Path $root 'test\fixtures\visio-com-multipage-smoke.vsdx'
$previewPath = Join-Path $root '.aifde\previews\visio-com-multipage-smoke.png'
$expectedPageCount = 3

$createOutput = & pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File (Join-Path $PSScriptRoot 'new-multipage-test-vsdx.ps1') -OutputPath $sourcePath -PageCount $expectedPageCount
$createJson = $createOutput | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1 | ConvertFrom-Json
if (-not $createJson.success) {
    throw "Failed to create multipage test VSDX: $($createJson.error)"
}
if ([int] $createJson.pageCount -ne $expectedPageCount) {
    throw "Created page count mismatch: expected=$expectedPageCount actual=$($createJson.pageCount)"
}

$exportOutput = & pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File (Join-Path $PSScriptRoot 'export-visio.ps1') -InputPath $sourcePath -OutputPath $previewPath -Format png
$exportJson = $exportOutput | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1 | ConvertFrom-Json
if (-not $exportJson.success) {
    throw "Failed to export multipage preview: $($exportJson.error)"
}
if ([int] $exportJson.pageCount -ne $expectedPageCount) {
    throw "Exported page count mismatch: expected=$expectedPageCount actual=$($exportJson.pageCount)"
}

$outputPaths = @($exportJson.outputPaths)
if ($outputPaths.Count -ne $expectedPageCount) {
    throw "Output path count mismatch: expected=$expectedPageCount actual=$($outputPaths.Count)"
}

$previewDirectory = [System.IO.Path]::GetDirectoryName($previewPath)
$previewName = [System.IO.Path]::GetFileNameWithoutExtension($previewPath)
$expectedPage2 = [System.IO.Path]::Combine($previewDirectory, "$previewName.page-2.png")
$expectedPage3 = [System.IO.Path]::Combine($previewDirectory, "$previewName.page-3.png")
foreach ($candidate in @($previewPath, $expectedPage2, $expectedPage3)) {
    if ($outputPaths -notcontains (Get-Item -LiteralPath $candidate -ErrorAction SilentlyContinue).FullName) {
        throw "Expected output path was not reported: $candidate"
    }
}

$bytes = 0
foreach ($candidate in $outputPaths) {
    if (-not (Test-Path -LiteralPath $candidate)) {
        throw "Reported preview path does not exist: $candidate"
    }
    $item = Get-Item -LiteralPath $candidate
    if ($item.Length -le 0) {
        throw "Reported preview path is empty: $candidate"
    }
    $bytes += $item.Length
}

@{
    success = $true
    sourcePath = $sourcePath
    previewPath = $previewPath
    outputPaths = $outputPaths
    pageCount = $exportJson.pageCount
    previewBytes = $bytes
    exportDurationMs = $exportJson.durationMs
} | ConvertTo-Json -Compress
