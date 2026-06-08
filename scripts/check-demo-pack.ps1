param(
    [string] $Root = (Join-Path $PSScriptRoot '..'),
    [switch] $RequireCurrentAcceptance
)

$ErrorActionPreference = 'Stop'

$rootPath = (Resolve-Path -LiteralPath $Root).ProviderPath
$packageJsonPath = Join-Path $rootPath 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$version = [string] $packageJson.version
$expectedPowerShellVersion = '7.6.2'
$powerShellVersion = $PSVersionTable.PSVersion.ToString()
$reportDirectory = Join-Path $rootPath '.aifde\reports'
$jsonPath = Join-Path $reportDirectory 'demo-pack.json'
$markdownPath = Join-Path $reportDirectory 'demo-pack.md'
$vsixPath = Join-Path $rootPath "ai-fde-vsdx-radar-$version.vsix"

if ($powerShellVersion -ne $expectedPowerShellVersion) {
    throw "Demo pack check must run on PowerShell $expectedPowerShellVersion, got $powerShellVersion"
}

if (-not (Test-Path -LiteralPath $jsonPath)) {
    throw "Demo pack JSON was not found: $jsonPath"
}
if (-not (Test-Path -LiteralPath $markdownPath)) {
    throw "Demo pack Markdown was not found: $markdownPath"
}
if (-not (Test-Path -LiteralPath $vsixPath)) {
    throw "Current version VSIX was not found: $vsixPath"
}

$demoPack = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json
$demoPackProperties = @($demoPack.PSObject.Properties | ForEach-Object { [string] $_.Name })
foreach ($requiredProperty in @(
    'previewFreshnessSummary',
    'previewFreshnessSummaryCount',
    'version',
    'powerShellVersion',
    'artifactCount',
    'previewGalleryCount',
    'latestAcceptance',
    'artifacts',
    'storyboard'
)) {
    if ($demoPackProperties -notcontains $requiredProperty) {
        throw "Demo pack JSON is missing $requiredProperty"
    }
}

if ([string] $demoPack.version -ne $version) {
    throw "Demo pack version mismatch: expected $version, got $($demoPack.version)"
}
if ([string] $demoPack.powerShellVersion -ne $expectedPowerShellVersion) {
    throw "Demo pack PowerShell version mismatch: expected $expectedPowerShellVersion, got $($demoPack.powerShellVersion)"
}
if ($null -eq $demoPack.previewFreshnessSummary) {
    throw 'Demo pack previewFreshnessSummary is null'
}
if ($null -eq $demoPack.previewFreshnessSummaryCount) {
    throw 'Demo pack previewFreshnessSummaryCount is null'
}

$artifactItems = @($demoPack.artifacts)
if ([int] $demoPack.artifactCount -ne $artifactItems.Count) {
    throw "Demo pack artifactCount mismatch: expected $($artifactItems.Count), got $($demoPack.artifactCount)"
}

$previewArtifacts = @($artifactItems | Where-Object {
    [string] $_.kind -eq 'preview' -and [long] $_.bytes -gt 100
})
if ([int] $demoPack.previewGalleryCount -ne $previewArtifacts.Count) {
    throw "Demo pack previewGalleryCount mismatch: expected $($previewArtifacts.Count), got $($demoPack.previewGalleryCount)"
}

$qaSummaryArtifacts = @($artifactItems | Where-Object {
    [string] $_.kind -eq 'qa-summary' -and [long] $_.bytes -gt 0
})
if ($qaSummaryArtifacts.Count -eq 0) {
    throw 'Demo pack artifacts do not include QA summary JSON or Markdown evidence'
}

$storyboardItems = @($demoPack.storyboard)
if ($storyboardItems.Count -eq 0) {
    throw 'Demo pack storyboard is empty'
}
foreach ($storyboardItem in $storyboardItems) {
    foreach ($requiredStoryboardProperty in @('step', 'artifactHint', 'talkTrack')) {
        if ([string]::IsNullOrWhiteSpace([string] $storyboardItem.$requiredStoryboardProperty)) {
            throw "Demo pack storyboard item is missing $requiredStoryboardProperty"
        }
    }
}

$summaryItems = @($demoPack.previewFreshnessSummary)
if ([int] $demoPack.previewFreshnessSummaryCount -ne $summaryItems.Count) {
    throw "Demo pack previewFreshnessSummaryCount mismatch: expected $($summaryItems.Count), got $($demoPack.previewFreshnessSummaryCount)"
}

$latestAcceptance = $demoPack.latestAcceptance
if ([string]::IsNullOrWhiteSpace([string] $latestAcceptance.status)) {
    throw 'Demo pack latestAcceptance status is missing'
}
if ([string]::IsNullOrWhiteSpace([string] $latestAcceptance.currentVersion)) {
    throw 'Demo pack latestAcceptance currentVersion is missing'
}
if ([string] $latestAcceptance.currentVersion -ne $version) {
    throw "Demo pack latestAcceptance currentVersion mismatch: expected $version, got $($latestAcceptance.currentVersion)"
}
if ($latestAcceptance.found -and -not (Test-Path -LiteralPath ([string] $latestAcceptance.path))) {
    throw "Demo pack latestAcceptance path does not exist: $($latestAcceptance.path)"
}
if ($RequireCurrentAcceptance -and -not [bool] $latestAcceptance.matchesCurrentVersion) {
    throw "Demo pack latest acceptance does not match current version ${version}: status=$($latestAcceptance.status), reportVersion=$($latestAcceptance.version)"
}

$expectedVsixLabel = "VSIX: ai-fde-vsdx-radar-$version.vsix"
$expectedVsixPath = (Get-Item -LiteralPath $vsixPath).FullName
$vsixArtifact = @($demoPack.artifacts | Where-Object {
    [string] $_.kind -eq 'vsix' -and
    [string] $_.label -eq $expectedVsixLabel -and
    [string] $_.path -eq $expectedVsixPath
}) | Select-Object -First 1
if (-not $vsixArtifact) {
    throw "Demo pack artifacts do not include the current VSIX: $expectedVsixLabel"
}

$demoPackMarkdown = Get-Content -LiteralPath $markdownPath -Raw
if ($demoPackMarkdown -notmatch '## Preview Freshness Summary') {
    throw 'Demo pack Markdown is missing Preview Freshness Summary'
}
if ($demoPackMarkdown -notmatch '## Acceptance Freshness') {
    throw 'Demo pack Markdown is missing Acceptance Freshness'
}
if ($demoPackMarkdown -notmatch '## Presenter Storyboard') {
    throw 'Demo pack Markdown is missing Presenter Storyboard'
}
if ($demoPackMarkdown -notmatch '## Preview Gallery') {
    throw 'Demo pack Markdown is missing Preview Gallery'
}
if ($demoPackMarkdown -notmatch '## Artifact Index') {
    throw 'Demo pack Markdown is missing Artifact Index'
}
if ($demoPackMarkdown -notmatch [regex]::Escape("Version: $version")) {
    throw "Demo pack Markdown version mismatch: $version"
}
if ($demoPackMarkdown -notmatch [regex]::Escape("PowerShell: $expectedPowerShellVersion")) {
    throw "Demo pack Markdown PowerShell version mismatch: $expectedPowerShellVersion"
}
if ($demoPackMarkdown -notmatch [regex]::Escape("| Status | $($latestAcceptance.status) |")) {
    throw "Demo pack Markdown latest acceptance status mismatch: $($latestAcceptance.status)"
}
if ($demoPackMarkdown -notmatch [regex]::Escape("Artifacts: $($demoPack.artifactCount)")) {
    throw "Demo pack Markdown artifact count mismatch: $($demoPack.artifactCount)"
}
if ($demoPackMarkdown -notmatch [regex]::Escape("Preview gallery: $($demoPack.previewGalleryCount)")) {
    throw "Demo pack Markdown preview gallery count mismatch: $($demoPack.previewGalleryCount)"
}
if ($demoPackMarkdown -notmatch [regex]::Escape($expectedVsixLabel)) {
    throw "Demo pack Markdown is missing current VSIX artifact: $expectedVsixLabel"
}
if ([int] $demoPack.previewGalleryCount -gt 0 -and $demoPackMarkdown -notmatch '!\[[^\]]+\]\([^)]+\)') {
    throw 'Demo pack Markdown preview gallery does not include preview image links'
}

[ordered]@{
    success = $true
    version = $version
    jsonPath = $jsonPath
    markdownPath = $markdownPath
    vsixPath = $expectedVsixPath
    powerShellVersion = $powerShellVersion
    artifactCount = [int] $demoPack.artifactCount
    previewGalleryCount = [int] $demoPack.previewGalleryCount
    qaSummaryCount = $qaSummaryArtifacts.Count
    previewFreshnessSummaryCount = [int] $demoPack.previewFreshnessSummaryCount
    latestAcceptanceStatus = [string] $latestAcceptance.status
    latestAcceptanceMatchesCurrentVersion = [bool] $latestAcceptance.matchesCurrentVersion
    requireCurrentAcceptance = [bool] $RequireCurrentAcceptance
    storyboardCount = $storyboardItems.Count
} | ConvertTo-Json
