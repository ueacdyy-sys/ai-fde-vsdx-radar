param(
    [string] $Root = (Join-Path $PSScriptRoot '..')
)

$ErrorActionPreference = 'Stop'

$rootPath = (Resolve-Path -LiteralPath $Root).ProviderPath
$imageDir = Join-Path $rootPath 'images'
New-Item -ItemType Directory -Path $imageDir -Force | Out-Null

Add-Type -AssemblyName System.Drawing

function New-Canvas {
    param(
        [int] $Width,
        [int] $Height,
        [System.Drawing.Color] $Color
    )

    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $graphics.Clear($Color)
    return [pscustomobject]@{
        Bitmap = $bitmap
        Graphics = $graphics
    }
}

function Save-Png {
    param(
        [System.Drawing.Bitmap] $Bitmap,
        [string] $Path
    )

    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-Icon {
    param([string] $Path)

    $canvas = New-Canvas -Width 256 -Height 256 -Color ([System.Drawing.Color]::FromArgb(255, 16, 36, 62))
    $g = $canvas.Graphics
    try {
        $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 49, 196, 190))
        $gold = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 249, 180, 70))
        $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 248, 252, 255))
        $gridPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(70, 248, 252, 255), 2)
        $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 49, 196, 190), 10)
        $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

        for ($x = 32; $x -le 224; $x += 32) {
            $g.DrawLine($gridPen, $x, 32, $x, 224)
        }
        for ($y = 32; $y -le 224; $y += 32) {
            $g.DrawLine($gridPen, 32, $y, 224, $y)
        }

        $g.FillEllipse($gold, 38, 46, 70, 70)
        $g.FillEllipse($white, 148, 42, 70, 70)
        $g.FillEllipse($accent, 96, 145, 70, 70)
        $g.DrawLine($linePen, 92, 82, 162, 78)
        $g.DrawLine($linePen, 178, 104, 136, 150)
        $g.DrawLine($linePen, 84, 110, 118, 156)

        $font = [System.Drawing.Font]::new('Segoe UI Semibold', 42, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $g.DrawString('QA', $font, $white, 82, 93)
        Save-Png -Bitmap $canvas.Bitmap -Path $Path
    }
    finally {
        $g.Dispose()
        $canvas.Bitmap.Dispose()
    }
}

function New-MarketplacePreview {
    param([string] $Path)

    $canvas = New-Canvas -Width 1280 -Height 720 -Color ([System.Drawing.Color]::FromArgb(255, 246, 248, 251))
    $g = $canvas.Graphics
    try {
        $navy = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 16, 36, 62))
        $panel = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 49, 196, 190))
        $gold = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 249, 180, 70))
        $red = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 214, 76, 76))
        $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 92, 105, 122))
        $border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 221, 228, 236), 2)
        $line = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 49, 196, 190), 5)
        $line.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $line.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

        $titleFont = [System.Drawing.Font]::new('Segoe UI Semibold', 44, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $hFont = [System.Drawing.Font]::new('Segoe UI Semibold', 25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $bodyFont = [System.Drawing.Font]::new('Segoe UI', 20, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $monoFont = [System.Drawing.Font]::new('Consolas', 17, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

        $g.FillRectangle($navy, 0, 0, 1280, 112)
        $g.DrawString('Visio VSDX Preview & QA', $titleFont, [System.Drawing.Brushes]::White, 48, 28)
        $g.DrawString('Preview cache + QA linter for VS Code', $bodyFont, $accent, 680, 50)

        $g.FillRectangle($panel, 48, 152, 366, 480)
        $g.DrawRectangle($border, 48, 152, 366, 480)
        $g.DrawString('VSDX Preview', $hFont, $navy, 74, 178)
        $g.FillEllipse($gold, 112, 282, 74, 74)
        $g.FillEllipse($accent, 252, 282, 74, 74)
        $g.FillEllipse($red, 182, 424, 74, 74)
        $g.DrawLine($line, 174, 318, 254, 318)
        $g.DrawLine($line, 288, 350, 218, 430)
        $g.DrawLine($line, 148, 350, 208, 430)
        $g.DrawString('PNG/PDF previews from local Visio', $bodyFont, $muted, 74, 560)

        $g.FillRectangle($panel, 456, 152, 366, 480)
        $g.DrawRectangle($border, 456, 152, 366, 480)
        $g.DrawString('QA Evidence', $hFont, $navy, 482, 178)
        $qaLines = @(
            '{',
            '  "pageCount": 3,',
            '  "shapeCount": 17,',
            '  "connectCount": 12,',
            '  "risks": [',
            '    "PREVIEW_STALE"',
            '  ]',
            '}'
        )
        $y = 232
        foreach ($qaLine in $qaLines) {
            $g.DrawString($qaLine, $monoFont, $muted, 490, $y)
            $y += 34
        }
        $g.FillRectangle($accent, 490, 526, 250, 12)
        $g.DrawString('.aifde/qa/*.qa.json + .md', $bodyFont, $muted, 482, 560)

        $g.FillRectangle($panel, 864, 152, 366, 480)
        $g.DrawRectangle($border, 864, 152, 366, 480)
        $g.DrawString('Risk Dashboard', $hFont, $navy, 890, 178)
        $rows = @(
            @('Status', 'Owner', 'Due'),
            @('ERROR', 'ME', 'Today'),
            @('RISK', 'QA', '+3d'),
            @('OK', 'FDE', '-')
        )
        $y = 238
        foreach ($row in $rows) {
            $brush = if ($row[0] -eq 'ERROR') { $red } elseif ($row[0] -eq 'RISK') { $gold } elseif ($row[0] -eq 'OK') { $accent } else { $navy }
            $g.DrawString($row[0], $monoFont, $brush, 900, $y)
            $g.DrawString($row[1], $monoFont, $muted, 1010, $y)
            $g.DrawString($row[2], $monoFont, $muted, 1100, $y)
            $y += 58
        }
        $g.DrawString('Filter, sort, assign, and review', $bodyFont, $muted, 890, 560)

        Save-Png -Bitmap $canvas.Bitmap -Path $Path
    }
    finally {
        $g.Dispose()
        $canvas.Bitmap.Dispose()
    }
}

$iconPath = Join-Path $imageDir 'icon.png'
$previewPath = Join-Path $imageDir 'marketplace-preview.png'
New-Icon -Path $iconPath
New-MarketplacePreview -Path $previewPath

[ordered]@{
    success = $true
    icon = $iconPath
    preview = $previewPath
} | ConvertTo-Json
