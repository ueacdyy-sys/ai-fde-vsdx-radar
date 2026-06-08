param(
    [string] $OutputPath = (Join-Path (Get-Location) 'test\fixtures\visio-com-smoke.vsdx')
)

$ErrorActionPreference = 'Stop'
$visio = $null
$document = $null

try {
    $outputDirectory = [System.IO.Path]::GetDirectoryName($OutputPath)
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    $visio = New-Object -ComObject Visio.Application
    $visio.Visible = $false
    $document = $visio.Documents.Add('')
    $page = $document.Pages.Item(1)

    $rect = $page.DrawRectangle(1, 8, 3, 9)
    $rect.Text = 'AI-FDE'
    $ellipse = $page.DrawOval(4, 8, 6, 9)
    $ellipse.Text = 'VSDX Radar'
    $connector = $page.Drop($visio.Application.ConnectorToolDataObject, 3.2, 8.5)
    $connector.CellsU('BeginX').GlueTo($rect.CellsU('PinX')) | Out-Null
    $connector.CellsU('EndX').GlueTo($ellipse.CellsU('PinX')) | Out-Null

    $document.SaveAs($OutputPath) | Out-Null
    @{ success = $true; outputPath = (Resolve-Path -LiteralPath $OutputPath).ProviderPath } | ConvertTo-Json -Compress
}
catch {
    @{ success = $false; outputPath = $OutputPath; error = $_.Exception.Message; errorType = $_.Exception.GetType().FullName } | ConvertTo-Json -Compress
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
