param(
    [string] $OutputPath = (Join-Path (Get-Location) 'test\fixtures\visio-com-multipage-smoke.vsdx'),
    [int] $PageCount = 3
)

$ErrorActionPreference = 'Stop'
$visio = $null
$document = $null

function Add-SmokePageContent {
    param(
        [Parameter(Mandatory = $true)]
        $Page,

        [Parameter(Mandatory = $true)]
        [int] $Index,

        [Parameter(Mandatory = $true)]
        $Application
    )

    $Page.Name = "AI-FDE Flow $Index"
    $left = $Page.DrawRectangle(1, 8, 3, 9)
    $left.Text = "Input $Index"
    $middle = $Page.DrawRectangle(3.7, 8, 5.7, 9)
    $middle.Text = "Process $Index"
    $right = $Page.DrawOval(6.4, 8, 8, 9)
    $right.Text = "Output $Index"

    $connectorA = $Page.Drop($Application.ConnectorToolDataObject, 3.3, 8.5)
    $connectorA.CellsU('BeginX').GlueTo($left.CellsU('PinX')) | Out-Null
    $connectorA.CellsU('EndX').GlueTo($middle.CellsU('PinX')) | Out-Null

    $connectorB = $Page.Drop($Application.ConnectorToolDataObject, 6.1, 8.5)
    $connectorB.CellsU('BeginX').GlueTo($middle.CellsU('PinX')) | Out-Null
    $connectorB.CellsU('EndX').GlueTo($right.CellsU('PinX')) | Out-Null
}

try {
    if ($PageCount -lt 2) {
        throw 'PageCount must be at least 2 for multipage smoke.'
    }

    $outputDirectory = [System.IO.Path]::GetDirectoryName($OutputPath)
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $visio = New-Object -ComObject Visio.Application
    $visio.Visible = $false
    $document = $visio.Documents.Add('')

    for ($i = 1; $i -le $PageCount; $i++) {
        $page = if ($i -eq 1) { $document.Pages.Item(1) } else { $document.Pages.Add() }
        Add-SmokePageContent -Page $page -Index $i -Application $visio.Application
    }

    $document.SaveAs($OutputPath) | Out-Null
    @{
        success = $true
        outputPath = (Resolve-Path -LiteralPath $OutputPath).ProviderPath
        pageCount = $PageCount
    } | ConvertTo-Json -Compress
}
catch {
    @{
        success = $false
        outputPath = $OutputPath
        pageCount = $PageCount
        error = $_.Exception.Message
        errorType = $_.Exception.GetType().FullName
    } | ConvertTo-Json -Compress
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
