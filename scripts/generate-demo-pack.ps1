param(
    [string] $Root = (Join-Path $PSScriptRoot '..')
)

$ErrorActionPreference = 'Stop'

$rootPath = (Resolve-Path -LiteralPath $Root).ProviderPath
$packageJsonPath = Join-Path $rootPath 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = [string] $packageJson.version
$reportRoot = Join-Path $rootPath '.aifde'
$reportDirectory = Join-Path $reportRoot 'reports'
$jsonPath = Join-Path $reportDirectory 'demo-pack.json'
$markdownPath = Join-Path $reportDirectory 'demo-pack.md'
$generatedAt = (Get-Date).ToString('o')
$powerShellVersion = $PSVersionTable.PSVersion.ToString()

New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null

$artifactList = [System.Collections.Generic.List[object]]::new()

function Add-DemoArtifact {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Kind,
        [Parameter(Mandatory = $true)]
        [string] $Label,
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    $item = Get-Item -LiteralPath $Path
    if (-not $item.PSIsContainer) {
        $script:artifactList.Add([ordered]@{
            kind = $Kind
            label = $Label
            path = $item.FullName
            bytes = $item.Length
            modifiedAt = $item.LastWriteTime.ToString('o')
        })
    }
}

function Add-DemoDirectoryArtifacts {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Directory,
        [Parameter(Mandatory = $true)]
        [string] $Kind,
        [Parameter(Mandatory = $true)]
        [string] $Pattern,
        [Parameter(Mandatory = $true)]
        [string] $LabelPrefix
    )

    if (-not (Test-Path -LiteralPath $Directory)) {
        return
    }

    Get-ChildItem -LiteralPath $Directory -File |
        Where-Object { $_.Name -match $Pattern } |
        Sort-Object -Property LastWriteTime, Name -Descending |
        ForEach-Object {
            Add-DemoArtifact -Kind $Kind -Label "${LabelPrefix}: $($_.Name)" -Path $_.FullName
        }
}

function Escape-MarkdownCell {
    param([AllowNull()][object] $Value)

    if ($null -eq $Value) {
        return '-'
    }

    return ([string] $Value).Replace('|', '\|').Replace("`r`n", '<br>').Replace("`n", '<br>')
}

function Escape-MarkdownImageAlt {
    param([string] $Value)

    $escaped = $Value -replace '[\[\]\(\)`]', ' '
    if ([string]::IsNullOrWhiteSpace($escaped)) {
        return 'preview'
    }
    return $escaped.Trim()
}

function Get-MarkdownRelativePath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $MarkdownPath,
        [Parameter(Mandatory = $true)]
        [string] $TargetPath
    )

    $relative = [System.IO.Path]::GetRelativePath((Split-Path -Parent $MarkdownPath), $TargetPath).Replace('\', '/')
    if ($relative.StartsWith('.')) {
        return $relative
    }
    return "./$relative"
}

function Get-DemoPreviewFreshnessSummary {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ReportDirectory
    )

    $candidates = @(
        'workspace-vsdx-report.json',
        'workspace-vsdx-risk-report.json',
        'workspace-vsdx-team-board.json'
    )

    foreach ($name in $candidates) {
        $candidatePath = Join-Path $ReportDirectory $name
        if (-not (Test-Path -LiteralPath $candidatePath)) {
            continue
        }

        try {
            $report = Get-Content -LiteralPath $candidatePath -Raw | ConvertFrom-Json
            $items = @($report.previewFreshnessSummary)
            if ($items.Count -eq 0) {
                continue
            }

            return @($items | ForEach-Object {
                [ordered]@{
                    reason = [string] $_.reason
                    count = [int] $_.count
                    files = @($_.files | ForEach-Object { [string] $_ })
                }
            })
        }
        catch {
            continue
        }
    }

    return @()
}

function Format-PreviewFreshnessSummaryFiles {
    param([AllowNull()][object] $Files)

    $items = @($Files | ForEach-Object { [string] $_ })
    if ($items.Count -eq 0) {
        return '-'
    }

    $visible = @($items | Select-Object -First 3)
    $suffix = ''
    if ($items.Count -gt $visible.Count) {
        $suffix = "; +$($items.Count - $visible.Count) more"
    }
    return ($visible -join '; ') + $suffix
}

function Get-LatestAcceptanceSummary {
    param(
        [Parameter(Mandatory = $true)]
        [string] $AcceptanceDirectory,
        [Parameter(Mandatory = $true)]
        [string] $CurrentVersion
    )

    if (-not (Test-Path -LiteralPath $AcceptanceDirectory)) {
        return [ordered]@{
            found = $false
            status = 'missing'
            path = $null
            generatedAt = $null
            modifiedAt = $null
            version = $null
            currentVersion = $CurrentVersion
            success = $null
            matchesCurrentVersion = $false
            detail = 'No acceptance report directory was found.'
        }
    }

    $latestReport = Get-ChildItem -LiteralPath $AcceptanceDirectory -Filter 'acceptance-*.json' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime, Name -Descending |
        Select-Object -First 1
    if (-not $latestReport) {
        return [ordered]@{
            found = $false
            status = 'missing'
            path = $null
            generatedAt = $null
            modifiedAt = $null
            version = $null
            currentVersion = $CurrentVersion
            success = $null
            matchesCurrentVersion = $false
            detail = 'No acceptance JSON report was found.'
        }
    }

    try {
        $report = Get-Content -LiteralPath $latestReport.FullName -Raw | ConvertFrom-Json
        $reportVersion = [string] $report.version
        $success = [bool] $report.success
        $matchesCurrentVersion = $reportVersion -eq $CurrentVersion
        $status = if (-not $success) {
            'failed'
        }
        elseif ($matchesCurrentVersion) {
            'current'
        }
        else {
            'stale'
        }
        $detail = switch ($status) {
            'current' { "Latest acceptance report matches current version $CurrentVersion." }
            'failed' { "Latest acceptance report did not pass for version $reportVersion." }
            default { "Latest acceptance report is for version $reportVersion; current version is $CurrentVersion." }
        }

        return [ordered]@{
            found = $true
            status = $status
            path = $latestReport.FullName
            generatedAt = [string] $report.generatedAt
            modifiedAt = $latestReport.LastWriteTime.ToString('o')
            version = $reportVersion
            currentVersion = $CurrentVersion
            success = $success
            matchesCurrentVersion = $matchesCurrentVersion
            detail = $detail
        }
    }
    catch {
        return [ordered]@{
            found = $true
            status = 'unreadable'
            path = $latestReport.FullName
            generatedAt = $null
            modifiedAt = $latestReport.LastWriteTime.ToString('o')
            version = $null
            currentVersion = $CurrentVersion
            success = $null
            matchesCurrentVersion = $false
            detail = "Latest acceptance report could not be parsed: $($_.Exception.Message)"
        }
    }
}

$currentVsix = Join-Path $rootPath "ai-fde-vsdx-radar-$version.vsix"
if (Test-Path -LiteralPath $currentVsix) {
    Add-DemoArtifact -Kind 'vsix' -Label "VSIX: ai-fde-vsdx-radar-$version.vsix" -Path $currentVsix
}
else {
    $latestVsix = Get-ChildItem -LiteralPath $rootPath -Filter 'ai-fde-vsdx-radar-*.vsix' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($latestVsix) {
        Add-DemoArtifact -Kind 'vsix' -Label "VSIX: $($latestVsix.Name)" -Path $latestVsix.FullName
    }
}

Add-DemoDirectoryArtifacts -Directory (Join-Path $rootPath 'test\fixtures') -Kind 'fixture' -Pattern '\.vsdx$' -LabelPrefix 'Fixture'
Add-DemoDirectoryArtifacts -Directory (Join-Path $reportRoot 'acceptance') -Kind 'acceptance' -Pattern '^acceptance-.*\.(md|json)$' -LabelPrefix 'Acceptance'
Add-DemoDirectoryArtifacts -Directory (Join-Path $reportRoot 'previews') -Kind 'preview' -Pattern '\.(png|pdf)$' -LabelPrefix 'Preview'
Add-DemoDirectoryArtifacts -Directory (Join-Path $reportRoot 'qa') -Kind 'qa-summary' -Pattern '\.qa\.(md|json)$' -LabelPrefix 'QA'
Add-DemoDirectoryArtifacts -Directory $reportDirectory -Kind 'report' -Pattern '^(workspace-vsdx|qa-|demo-pack).*?\.(md|json|ics)$' -LabelPrefix 'Report'

$artifacts = @($artifactList | Sort-Object kind, label)
$previewArtifacts = @($artifacts | Where-Object { $_.kind -eq 'preview' -and $_.bytes -gt 100 })
$previewFreshnessSummary = @(Get-DemoPreviewFreshnessSummary -ReportDirectory $reportDirectory)
$latestAcceptance = Get-LatestAcceptanceSummary -AcceptanceDirectory (Join-Path $reportRoot 'acceptance') -CurrentVersion $version
$storyboard = @(
    [ordered]@{
        step = 'Acceptance proof'
        artifactHint = '.aifde/acceptance/acceptance-*.md'
        talkTrack = 'Show PASS status, PowerShell 7.6.2, manifest command count, VSIX packaging, installation, and route corpus QA evidence.'
    },
    [ordered]@{
        step = 'Single-page preview'
        artifactHint = '.aifde/previews/visio-com-smoke.png'
        talkTrack = 'Show how a VSDX becomes an inspectable PNG preview and QA summary inside the workspace.'
    },
    [ordered]@{
        step = 'Multi-page preview'
        artifactHint = '.aifde/previews/visio-com-multipage-smoke*.png'
        talkTrack = 'Show page-2/page-3 preview assets and explain multi-page coverage.'
    },
    [ordered]@{
        step = 'Connector route corpus'
        artifactHint = 'test/fixtures/connector-route-corpus.vsdx'
        talkTrack = 'Explain that complex connector routes are covered by automated QA without diagonal or crossing false positives.'
    },
    [ordered]@{
        step = 'Duplicate Shape ID corpus'
        artifactHint = 'test/fixtures/duplicate-shape-id-same-page-group-corpus.vsdx'
        talkTrack = 'Explain that same-page duplicate Shape IDs are surfaced and no longer suppress connector-crossing evidence.'
    },
    [ordered]@{
        step = 'Team risk workflow'
        artifactHint = '.aifde/reports/workspace-vsdx-team-board.md'
        talkTrack = 'Show owner workload, review lanes, due risk reminders, and how the dashboard persists remediation notes.'
    },
    [ordered]@{
        step = 'QA profile strategy'
        artifactHint = '.aifde/reports/qa-profile-strategy-template.md'
        talkTrack = 'Show reusable delivery-readiness, inventory-baseline, and layout-triage strategies for team settings.'
    }
)

$payload = [ordered]@{
    schemaVersion = 1
    generatedAt = $generatedAt
    workspaceRoot = $rootPath
    version = $version
    powerShellVersion = $powerShellVersion
    artifactCount = $artifacts.Count
    previewGalleryCount = $previewArtifacts.Count
    previewFreshnessSummaryCount = $previewFreshnessSummary.Count
    previewFreshnessSummary = $previewFreshnessSummary
    latestAcceptance = $latestAcceptance
    artifacts = $artifacts
    storyboard = $storyboard
}

$payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$markdown = [System.Collections.Generic.List[string]]::new()
foreach ($line in @(
    '# AI-FDE VSDX Demo Pack',
    '',
    "Generated: $generatedAt",
    "Workspace: ``$rootPath``",
    "Version: $version",
    "PowerShell: $powerShellVersion",
    "Artifacts: $($artifacts.Count)",
    "Preview gallery: $($previewArtifacts.Count)",
    "Preview freshness reasons: $($previewFreshnessSummary.Count)",
    '',
    '## Acceptance Freshness',
    '',
    '| Field | Value |',
    '| ----- | ----- |',
    "| Status | $(Escape-MarkdownCell $latestAcceptance.status) |",
    "| Matches current version | $(Escape-MarkdownCell $latestAcceptance.matchesCurrentVersion) |",
    "| Report version | $(Escape-MarkdownCell $latestAcceptance.version) |",
    "| Current version | $(Escape-MarkdownCell $latestAcceptance.currentVersion) |",
    "| Success | $(Escape-MarkdownCell $latestAcceptance.success) |",
    "| Report | $(Escape-MarkdownCell $latestAcceptance.path) |",
    "| Detail | $(Escape-MarkdownCell $latestAcceptance.detail) |",
    '',
    '## Preview Freshness Summary',
    '',
    '| Reason | Count | Sample files |',
    '| ------ | ----- | ------------ |'
)) {
    $markdown.Add($line)
}
if ($previewFreshnessSummary.Count -eq 0) {
    $markdown.Add('| - | 0 | - |')
}
else {
    foreach ($item in $previewFreshnessSummary) {
        $markdown.Add("| $(Escape-MarkdownCell $item.reason) | $($item.count) | $(Escape-MarkdownCell (Format-PreviewFreshnessSummaryFiles $item.files)) |")
    }
}
foreach ($line in @(
    '',
    '## Presenter Storyboard',
    '',
    '| Step | Artifact hint | Talk track |',
    '| ---- | ------------- | ---------- |'
)) {
    $markdown.Add($line)
}
foreach ($item in $storyboard) {
    $markdown.Add("| $(Escape-MarkdownCell $item.step) | $(Escape-MarkdownCell $item.artifactHint) | $(Escape-MarkdownCell $item.talkTrack) |")
}
foreach ($line in @(
    '',
    '## Preview Gallery',
    ''
)) {
    $markdown.Add($line)
}
if ($previewArtifacts.Count -eq 0) {
    $markdown.Add('- No preview assets found.')
}
else {
    foreach ($artifact in $previewArtifacts) {
        $markdown.Add("### $($artifact.label)")
        $markdown.Add('')
        $markdown.Add("![$(Escape-MarkdownImageAlt $artifact.label)]($(Get-MarkdownRelativePath -MarkdownPath $markdownPath -TargetPath $artifact.path))")
        $markdown.Add('')
    }
}
foreach ($line in @(
    '',
    '## Artifact Index',
    '',
    '| Kind | Label | Bytes | Modified | Path |',
    '| ---- | ----- | ----- | -------- | ---- |'
)) {
    $markdown.Add($line)
}
if ($artifacts.Count -eq 0) {
    $markdown.Add('| - | - | - | - | - |')
}
else {
    foreach ($artifact in $artifacts) {
        $markdown.Add("| $(Escape-MarkdownCell $artifact.kind) | $(Escape-MarkdownCell $artifact.label) | $($artifact.bytes) | $(Escape-MarkdownCell $artifact.modifiedAt) | $(Escape-MarkdownCell $artifact.path) |")
    }
}

$markdown -join "`n" | Set-Content -LiteralPath $markdownPath -Encoding UTF8

[ordered]@{
    success = $true
    jsonPath = $jsonPath
    markdownPath = $markdownPath
    powerShellVersion = $powerShellVersion
    artifacts = $artifacts.Count
    previewGallery = $previewArtifacts.Count
    latestAcceptanceStatus = [string] $latestAcceptance.status
    latestAcceptanceMatchesCurrentVersion = [bool] $latestAcceptance.matchesCurrentVersion
} | ConvertTo-Json
