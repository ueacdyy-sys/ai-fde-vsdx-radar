param(
    [Parameter(Mandatory = $true)]
    [string] $InputPath,

    [Parameter(Mandatory = $true)]
    [string] $OutputPath,

    [ValidateSet('png', 'pdf')]
    [string] $Format = 'png'
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

function Get-PageOutputPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $BaseOutputPath,

        [Parameter(Mandatory = $true)]
        [int] $PageIndex
    )

    if ($PageIndex -eq 1) {
        return $BaseOutputPath
    }

    $directory = [System.IO.Path]::GetDirectoryName($BaseOutputPath)
    $name = [System.IO.Path]::GetFileNameWithoutExtension($BaseOutputPath)
    $extension = [System.IO.Path]::GetExtension($BaseOutputPath)
    return [System.IO.Path]::Combine($directory, "$name.page-$PageIndex$extension")
}

try {
    $resolvedInput = (Resolve-Path -LiteralPath $InputPath).ProviderPath
    $outputDirectory = [System.IO.Path]::GetDirectoryName($OutputPath)
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $visio = New-Object -ComObject Visio.Application
    $visio.Visible = $false

    $visOpenRO = 2
    $visOpenDontList = 8
    $visOpenHidden = 64
    $openFlags = $visOpenRO -bor $visOpenDontList -bor $visOpenHidden
    $document = $visio.Documents.OpenEx($resolvedInput, $openFlags)
    $pageCount = [int]$document.Pages.Count
    $outputPaths = @()

    if ($Format -eq 'pdf') {
        $visFixedFormatPDF = 1
        $visDocExIntentScreen = 0
        $visPrintAll = 0
        $document.ExportAsFixedFormat($visFixedFormatPDF, $OutputPath, $visDocExIntentScreen, $visPrintAll) | Out-Null
        $outputPaths += (Get-Item -LiteralPath $OutputPath).FullName
    }
    else {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($OutputPath)
        Get-ChildItem -LiteralPath $outputDirectory -Filter "$name.page-*.png" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

        for ($i = 1; $i -le $pageCount; $i++) {
            $page = $document.Pages.Item($i)
            $pageOutputPath = Get-PageOutputPath -BaseOutputPath $OutputPath -PageIndex $i
            $page.Export($pageOutputPath) | Out-Null
            $outputPaths += (Get-Item -LiteralPath $pageOutputPath).FullName
        }
    }

    $outputItem = Get-Item -LiteralPath $OutputPath
    $bytes = ($outputPaths | ForEach-Object { (Get-Item -LiteralPath $_).Length } | Measure-Object -Sum).Sum
    $completed = Get-Date
    Write-JsonResult @{
        success = $true
        inputPath = $resolvedInput
        outputPath = $outputItem.FullName
        outputPaths = $outputPaths
        format = $Format
        pageCount = $pageCount
        durationMs = [int]($completed - $started).TotalMilliseconds
        bytes = [int64]$bytes
    }
}
catch {
    $completed = Get-Date
    Write-JsonResult @{
        success = $false
        inputPath = $InputPath
        outputPath = $OutputPath
        format = $Format
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
