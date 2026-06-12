param(
    [Parameter(Mandatory = $true)]
    [string] $InputPath,

    [Parameter(Mandatory = $true)]
    [string] $OutputPath
)

$ErrorActionPreference = 'Stop'
$started = Get-Date
$visio = $null
$document = $null

function Write-JsonResult {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable] $Data
    )

    $Data | ConvertTo-Json -Compress -Depth 8
}

function Get-OutputFormat {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
    switch ($extension) {
        '.vssx' { return 'vssx' }
        '.vstx' { return 'vstx' }
        '.vsdx' { return 'vsdx' }
        default { throw "OutputPath must end with .vsdx, .vssx, or .vstx: $Path" }
    }
}

try {
    $resolvedInput = (Resolve-Path -LiteralPath $InputPath).ProviderPath
    $outputDirectory = [System.IO.Path]::GetDirectoryName($OutputPath)
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
    $outputFormat = Get-OutputFormat -Path $resolvedOutput

    $visio = New-Object -ComObject Visio.Application
    $visio.Visible = $false
    try { $visio.AlertResponse = 1 } catch {}
    try { $visio.AutomationSecurity = 3 } catch {}

    $visOpenRO = 2
    $visOpenDontList = 8
    $visOpenHidden = 64
    $openFlags = $visOpenRO -bor $visOpenDontList -bor $visOpenHidden
    $document = $visio.Documents.OpenEx($resolvedInput, $openFlags)
    $pageCount = [int]$document.Pages.Count

    if (Test-Path -LiteralPath $resolvedOutput) {
        Remove-Item -LiteralPath $resolvedOutput -Force
    }

    $document.SaveAs($resolvedOutput) | Out-Null

    $outputItem = Get-Item -LiteralPath $resolvedOutput
    $completed = Get-Date
    Write-JsonResult @{
        success = $true
        inputPath = $resolvedInput
        outputPath = $outputItem.FullName
        outputFormat = $outputFormat
        pageCount = $pageCount
        durationMs = [int]($completed - $started).TotalMilliseconds
        bytes = [int64]$outputItem.Length
    }
}
catch {
    $completed = Get-Date
    $outputFormat = 'vsdx'
    try { $outputFormat = Get-OutputFormat -Path $OutputPath } catch {}
    Write-JsonResult @{
        success = $false
        inputPath = $InputPath
        outputPath = $OutputPath
        outputFormat = $outputFormat
        durationMs = [int]($completed - $started).TotalMilliseconds
        error = $_.Exception.Message
        errorType = $_.Exception.GetType().FullName
    }
    exit 1
}
finally {
    if ($document -ne $null) {
        try { $document.Close() | Out-Null } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null } catch {}
    }
    if ($visio -ne $null) {
        try { $visio.Quit() | Out-Null } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($visio) | Out-Null } catch {}
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
