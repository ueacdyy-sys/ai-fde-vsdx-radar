param(
    [string] $CodeCommand = 'code',
    [switch] $SkipInstall
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$packageJsonPath = Join-Path $root 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = [string] $packageJson.version
$extensionId = "$($packageJson.publisher).$($packageJson.name)"
$vsixPath = Join-Path $root "ai-fde-vsdx-radar-$version.vsix"
$reportDirectory = Join-Path $root '.aifde\acceptance'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$jsonReportPath = Join-Path $reportDirectory "acceptance-$timestamp.json"
$markdownReportPath = Join-Path $reportDirectory "acceptance-$timestamp.md"

New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null

$steps = [System.Collections.Generic.List[object]]::new()

function Invoke-AcceptanceStep {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [Parameter(Mandatory = $true)]
        [scriptblock] $Script,
        [switch] $AllowFailure
    )

    $startedAt = Get-Date
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    $output = @()
    $exitCode = 0
    $global:LASTEXITCODE = 0
    try {
        $output = @(& $Script 2>&1 | ForEach-Object { $_.ToString() })
        $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    }
    catch {
        $exitCode = 1
        $output = @($_.Exception.Message)
    }
    $timer.Stop()

    $step = [ordered]@{
        name = $Name
        startedAt = $startedAt.ToString('o')
        durationMs = $timer.ElapsedMilliseconds
        exitCode = $exitCode
        output = $output
    }
    $script:steps.Add($step)

    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "Acceptance step failed: $Name (exitCode=$exitCode)"
    }

    return $step
}

function Write-AcceptanceReports {
    param(
        [Parameter(Mandatory = $true)]
        [object] $Result
    )

    $Result.generatedAt = (Get-Date).ToString('o')
    $Result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonReportPath -Encoding UTF8

    $status = if ($Result.success) { 'PASS' } else { 'FAIL' }
    $markdown = [System.Collections.Generic.List[string]]::new()
    foreach ($line in @(
        '# AI-FDE VSDX Radar Acceptance Report',
        '',
        "- Status: $status",
        "- Generated: $($Result.generatedAt)",
        "- Version: $version",
        "- PowerShell: $($Result.pwshVersion)",
        "- Node.js: $($Result.nodeVersion)",
        "- npm: $($Result.npmVersion)",
        "- VSIX: $vsixPath",
        "- VSIX bytes: $($Result.vsixBytes)",
        "- Installed extension: $($Result.installedExtension)",
        '',
        '## Steps',
        '',
        '| Step | Exit code | Duration ms |',
        '| ---- | --------- | ----------- |'
    )) {
        $markdown.Add($line)
    }
    foreach ($step in $steps) {
        $markdown.Add("| $($step.name) | $($step.exitCode) | $($step.durationMs) |")
    }
    foreach ($line in @(
        '',
        '## Reports',
        '',
        "- JSON: $jsonReportPath",
        "- Markdown: $markdownReportPath",
        "- Demo pack JSON: $($Result.demoPackJsonPath)",
        "- Demo pack Markdown: $($Result.demoPackMarkdownPath)"
    )) {
        $markdown.Add($line)
    }
    if (-not $Result.success) {
        foreach ($line in @(
            '',
            '## Error',
            '',
            $Result.error
        )) {
            $markdown.Add($line)
        }
    }
    $markdown -join "`n" | Set-Content -LiteralPath $markdownReportPath -Encoding UTF8
}

$result = [ordered]@{
    success = $false
    generatedAt = (Get-Date).ToString('o')
    root = $root
    version = $version
    pwshVersion = $PSVersionTable.PSVersion.ToString()
    nodeVersion = $null
    npmVersion = $null
    vsixPath = $vsixPath
    vsixBytes = $null
    demoPackJsonPath = Join-Path $root '.aifde\reports\demo-pack.json'
    demoPackMarkdownPath = Join-Path $root '.aifde\reports\demo-pack.md'
    installedExtension = $null
    postAcceptanceDemoPackRefreshed = $false
    strictDemoPackCheckAfterReport = $false
    jsonReportPath = $jsonReportPath
    markdownReportPath = $markdownReportPath
    steps = $steps
}

$exitCode = 0
try {
    $nodeVersion = @(& node --version 2>$null | ForEach-Object { $_.ToString() }) | Select-Object -First 1
    $npmVersion = @(& npm.cmd --version 2>$null | ForEach-Object { $_.ToString() }) | Select-Object -First 1
    $result.nodeVersion = $nodeVersion
    $result.npmVersion = $npmVersion

    Push-Location -LiteralPath $root
    try {
        Invoke-AcceptanceStep -Name 'check manifest contributions' -Script {
            $manifest = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
            $expectedCommands = @(
                'aiFdeVsdxRadar.convertToModernVisio',
                'aiFdeVsdxRadar.exportPreview',
                'aiFdeVsdxRadar.runQa',
                'aiFdeVsdxRadar.exportAndQa',
                'aiFdeVsdxRadar.openPreview',
                'aiFdeVsdxRadar.openAllPreviews',
                'aiFdeVsdxRadar.openQaReport',
                'aiFdeVsdxRadar.showStatus',
                'aiFdeVsdxRadar.revealArtifacts',
                'aiFdeVsdxRadar.generateWorkspaceReport',
                'aiFdeVsdxRadar.generateWorkspaceRiskReport',
                'aiFdeVsdxRadar.generateWorkspaceDueRiskReport',
                'aiFdeVsdxRadar.exportWorkspaceDueRiskCalendar',
                'aiFdeVsdxRadar.showWorkspaceDueRiskReminder',
                'aiFdeVsdxRadar.generateWorkspaceTeamBoard',
                'aiFdeVsdxRadar.generateDemoPack',
                'aiFdeVsdxRadar.generateQaConfigTemplate',
                'aiFdeVsdxRadar.generateQaProfileStrategyTemplate',
                'aiFdeVsdxRadar.exportQaConfig',
                'aiFdeVsdxRadar.importQaConfig',
                'aiFdeVsdxRadar.generateQaConfigDiffReport',
                'aiFdeVsdxRadar.rollbackQaConfig',
                'aiFdeVsdxRadar.applyQaConfigProfile',
                'aiFdeVsdxRadar.applyQaConfigProfileStack',
                'aiFdeVsdxRadar.applyQaProfileStrategy',
                'aiFdeVsdxRadar.openQaProfileAuditReport',
                'aiFdeVsdxRadar.openWorkspaceRiskDashboard',
                'aiFdeVsdxRadar.openHighestPriorityRisk',
                'aiFdeVsdxRadar.openNextDueRisk',
                'aiFdeVsdxRadar.openAllRiskReports'
            )
            $expectedExplorerCommands = @(
                'aiFdeVsdxRadar.convertToModernVisio',
                'aiFdeVsdxRadar.exportPreview',
                'aiFdeVsdxRadar.runQa',
                'aiFdeVsdxRadar.exportAndQa',
                'aiFdeVsdxRadar.openPreview',
                'aiFdeVsdxRadar.openAllPreviews',
                'aiFdeVsdxRadar.openQaReport',
                'aiFdeVsdxRadar.showStatus',
                'aiFdeVsdxRadar.revealArtifacts'
            )
            $actualCommands = @($manifest.contributes.commands | ForEach-Object { [string] $_.command })
            $menuCommands = @($manifest.contributes.menus.'explorer/context' | ForEach-Object { [string] $_.command })
            $expectedConfigKeys = @(
                'aiFdeVsdxRadar.pwshPath',
                'aiFdeVsdxRadar.outputDirectory',
                'aiFdeVsdxRadar.previewFormat',
                'aiFdeVsdxRadar.qaPreset',
                'aiFdeVsdxRadar.autoExportOnSave',
                'aiFdeVsdxRadar.exportTimeoutMs',
                'aiFdeVsdxRadar.convertTimeoutMs',
                'aiFdeVsdxRadar.shapeDensityWarningThreshold',
                'aiFdeVsdxRadar.connectorRatioWarningThreshold',
                'aiFdeVsdxRadar.pageCoverageLowWarningThreshold',
                'aiFdeVsdxRadar.pageCoverageHighWarningThreshold',
                'aiFdeVsdxRadar.enableShapeDensityWarning',
                'aiFdeVsdxRadar.enableConnectorRatioWarning',
                'aiFdeVsdxRadar.enableUnlabeledShapeWarning',
                'aiFdeVsdxRadar.enablePageCoverageWarning',
                'aiFdeVsdxRadar.enableDiagonalConnectorWarning',
                'aiFdeVsdxRadar.enableConnectorCrossingWarning',
                'aiFdeVsdxRadar.enableDanglingConnectorWarning',
                'aiFdeVsdxRadar.enableShapeOverlapWarning'
            )
            $configKeys = @($manifest.contributes.configuration.properties.PSObject.Properties | ForEach-Object { [string] $_.Name })

            foreach ($expected in $expectedCommands) {
                if ($actualCommands -notcontains $expected) {
                    throw "Missing contributed command: $expected"
                }
            }
            foreach ($expected in $expectedExplorerCommands) {
                if ($menuCommands -notcontains $expected) {
                    throw "Missing explorer menu command: $expected"
                }
            }
            foreach ($expected in $expectedConfigKeys) {
                if ($configKeys -notcontains $expected) {
                    throw "Missing configuration key: $expected"
                }
            }

            "commands=$($actualCommands.Count)"
            "explorerMenuCommands=$($menuCommands.Count)"
            "configurationKeys=$($configKeys.Count)"
        } | Out-Null
        Invoke-AcceptanceStep -Name 'npm run verify' -Script { npm.cmd run verify } | Out-Null
        Invoke-AcceptanceStep -Name 'npm run qa:evidence' -Script { npm.cmd run 'qa:evidence' } | Out-Null
        Invoke-AcceptanceStep -Name 'npm run package' -Script { npm.cmd run package } | Out-Null

        if (-not (Test-Path -LiteralPath $vsixPath)) {
            throw "Expected VSIX was not created: $vsixPath"
        }
        $result.vsixBytes = (Get-Item -LiteralPath $vsixPath).Length

        Invoke-AcceptanceStep -Name 'npm run demo:pack' -Script { npm.cmd run 'demo:pack' } | Out-Null
        if (-not (Test-Path -LiteralPath $result.demoPackJsonPath)) {
            throw "Expected demo pack JSON was not created: $($result.demoPackJsonPath)"
        }
        if (-not (Test-Path -LiteralPath $result.demoPackMarkdownPath)) {
            throw "Expected demo pack Markdown was not created: $($result.demoPackMarkdownPath)"
        }
        Invoke-AcceptanceStep -Name 'npm run demo:pack:check' -Script { npm.cmd run 'demo:pack:check' } | Out-Null

        if (-not $SkipInstall) {
            $installStep = Invoke-AcceptanceStep -Name 'install VSIX' -AllowFailure -Script { & $CodeCommand --install-extension $vsixPath --force }
            $listStep = Invoke-AcceptanceStep -Name 'check installed extension' -Script { & $CodeCommand --list-extensions --show-versions }
            $installedLine = @($listStep.output) | Where-Object { $_ -like "*$extensionId@$version*" } | Select-Object -First 1
            if (-not $installedLine) {
                throw "Installed extension version was not found: $extensionId@$version; install exitCode=$($installStep.exitCode)"
            }
            $result.installedExtension = $installedLine
        }

        $result.success = $true
    }
    finally {
        Pop-Location
    }
}
catch {
    $exitCode = 1
    $result.error = $_.Exception.Message
}
finally {
    Write-AcceptanceReports -Result $result

    if ($result.success) {
        try {
            Push-Location -LiteralPath $root
            try {
                Invoke-AcceptanceStep -Name 'refresh demo pack after acceptance report' -Script { npm.cmd run 'demo:pack' } | Out-Null
                $result.postAcceptanceDemoPackRefreshed = $true
                Invoke-AcceptanceStep -Name 'npm run demo:pack:check:strict' -Script { npm.cmd run 'demo:pack:check:strict' } | Out-Null
                $result.strictDemoPackCheckAfterReport = $true
            }
            finally {
                Pop-Location
            }
        }
        catch {
            $exitCode = 1
            $result.success = $false
            $result.error = $_.Exception.Message
        }

        Write-AcceptanceReports -Result $result
    }

    $result | ConvertTo-Json -Depth 8
}

if ($exitCode -ne 0) {
    exit $exitCode
}
