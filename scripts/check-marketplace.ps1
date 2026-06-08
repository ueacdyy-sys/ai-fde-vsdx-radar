param(
    [string] $Root = (Join-Path $PSScriptRoot '..')
)

$ErrorActionPreference = 'Stop'

$rootPath = (Resolve-Path -LiteralPath $Root).ProviderPath
$packageJsonPath = Join-Path $rootPath 'package.json'
$readmePath = Join-Path $rootPath 'README.md'
$changelogPath = Join-Path $rootPath 'CHANGELOG.md'
$licensePath = Join-Path $rootPath 'LICENSE.txt'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json

function Assert-NonEmptyString {
    param(
        [string] $Name,
        [object] $Value
    )

    if ([string]::IsNullOrWhiteSpace([string] $Value)) {
        throw "package.json is missing $Name"
    }
}

function Assert-HttpsUrl {
    param(
        [string] $Name,
        [object] $Value
    )

    Assert-NonEmptyString -Name $Name -Value $Value
    if ([string] $Value -notmatch '^https://') {
        throw "$Name must be an https URL: $Value"
    }
}

Assert-NonEmptyString -Name 'name' -Value $packageJson.name
Assert-NonEmptyString -Name 'displayName' -Value $packageJson.displayName
Assert-NonEmptyString -Name 'description' -Value $packageJson.description
Assert-NonEmptyString -Name 'version' -Value $packageJson.version
Assert-NonEmptyString -Name 'publisher' -Value $packageJson.publisher
Assert-NonEmptyString -Name 'license' -Value $packageJson.license

if ([string] $packageJson.publisher -match '^local') {
    throw "Publisher should be a Marketplace publisher id, not a local id: $($packageJson.publisher)"
}
if ([string] $packageJson.license -eq 'UNLICENSED') {
    throw 'Marketplace package should not use UNLICENSED'
}
if ($packageJson.PSObject.Properties.Name -contains 'private' -and [bool] $packageJson.private) {
    throw 'Marketplace package should not be marked private'
}
if (-not (Test-Path -LiteralPath $readmePath)) {
    throw 'README.md is required for Marketplace presentation'
}
if (-not (Test-Path -LiteralPath $changelogPath)) {
    throw 'CHANGELOG.md is required for release notes'
}
if (-not (Test-Path -LiteralPath $licensePath)) {
    throw 'LICENSE.txt is required'
}

Assert-HttpsUrl -Name 'repository.url' -Value $packageJson.repository.url
Assert-HttpsUrl -Name 'bugs.url' -Value $packageJson.bugs.url
Assert-HttpsUrl -Name 'homepage' -Value $packageJson.homepage

$allowedCategories = @(
    'Programming Languages',
    'Snippets',
    'Linters',
    'Themes',
    'Debuggers',
    'Formatters',
    'Keymaps',
    'SCM Providers',
    'Other',
    'Extension Packs',
    'Language Packs',
    'Data Science',
    'Machine Learning',
    'Visualization',
    'Notebooks',
    'Education',
    'Testing'
)
$categories = @($packageJson.categories | ForEach-Object { [string] $_ })
if ($categories.Count -eq 0) {
    throw 'At least one Marketplace category is required'
}
foreach ($category in $categories) {
    if ($allowedCategories -notcontains $category) {
        throw "Unsupported Marketplace category: $category"
    }
}

$iconRelativePath = [string] $packageJson.icon
Assert-NonEmptyString -Name 'icon' -Value $iconRelativePath
if ($iconRelativePath -match '\.svg$') {
    throw 'Marketplace icon must not be SVG'
}
$iconPath = Join-Path $rootPath $iconRelativePath
if (-not (Test-Path -LiteralPath $iconPath)) {
    throw "Marketplace icon was not found: $iconPath"
}

Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Image]::FromFile($iconPath)
try {
    if ($icon.Width -lt 128 -or $icon.Height -lt 128) {
        throw "Marketplace icon must be at least 128x128, got $($icon.Width)x$($icon.Height)"
    }
}
finally {
    $icon.Dispose()
}

foreach ($markdownPath in @($readmePath, $changelogPath)) {
    $markdown = Get-Content -LiteralPath $markdownPath -Raw
    $imageMatches = [regex]::Matches($markdown, '!\[[^\]]*\]\(([^)]+)\)')
    foreach ($match in $imageMatches) {
        $target = [string] $match.Groups[1].Value
        if ($target -match '\.svg($|[?#])') {
            throw "Markdown images must not reference SVG files: $markdownPath -> $target"
        }
        if ($target -match '^http://' ) {
            throw "Markdown image URLs must use https: $markdownPath -> $target"
        }
        if ($target -notmatch '^https://' -and $target -notmatch '^[a-z]+:' -and $target -notmatch '^#') {
            $relativeTarget = $target -replace '[?#].*$', ''
            $assetPath = Join-Path (Split-Path -Parent $markdownPath) $relativeTarget
            if (-not (Test-Path -LiteralPath $assetPath)) {
                throw "Markdown image asset was not found: $markdownPath -> $target"
            }
        }
    }
}

[ordered]@{
    success = $true
    version = [string] $packageJson.version
    publisher = [string] $packageJson.publisher
    icon = (Get-Item -LiteralPath $iconPath).FullName
    categories = $categories
    readme = $readmePath
    changelog = $changelogPath
    license = $licensePath
} | ConvertTo-Json
