Add-Type -AssemblyName System.Drawing
if (-not (Test-Path build)) {
    New-Item -ItemType Directory -Force -Path build | Out-Null
}

$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::Transparent)

# Outer circular tech badge (#090a0f)
$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 9, 10, 15))
$g.FillEllipse($bgBrush, 8, 8, 240, 240)

# Neon green glow ring #22c55e
$glowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 34, 197, 94), 4)
$g.DrawEllipse($glowPen, 10, 10, 236, 236)

# Screen 1 (Primary monitor in background #1e293b)
$screen1Brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 41, 59))
$screen1Pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 71, 85, 105), 3)
$g.FillRectangle($screen1Brush, 40, 48, 116, 76)
$g.DrawRectangle($screen1Pen, 40, 48, 116, 76)

# Stand 1
$standBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 71, 85, 105))
$g.FillRectangle($standBrush, 92, 124, 12, 20)
$g.FillRectangle($standBrush, 76, 144, 44, 6)

# Screen 2 (Target / Second display featured in foreground with vibrant neon green accent)
$screen2Brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 18, 20, 29))
$screen2Pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 34, 197, 94), 4)
$g.FillRectangle($screen2Brush, 96, 88, 120, 80)
$g.DrawRectangle($screen2Pen, 96, 88, 120, 80)

# Inner display active area (green tint glow)
$innerScreenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(60, 34, 197, 94))
$g.FillRectangle($innerScreenBrush, 106, 98, 100, 60)

# Target cursor crosshair / remote arrow
$cursorPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 34, 197, 94), 3)
$cursorBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$points = @(
    (New-Object System.Drawing.Point 140, 114),
    (New-Object System.Drawing.Point 164, 126),
    (New-Object System.Drawing.Point 152, 130),
    (New-Object System.Drawing.Point 160, 144),
    (New-Object System.Drawing.Point 152, 148),
    (New-Object System.Drawing.Point 144, 134),
    (New-Object System.Drawing.Point 140, 142)
)
$g.FillPolygon($cursorBrush, $points)
$g.DrawPolygon($screen2Pen, $points)

$greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 34, 197, 94))

# Stand 2
$g.FillRectangle($greenBrush, 150, 168, 12, 18)
$g.FillRectangle($greenBrush, 134, 186, 44, 6)

$bmp.Save('assets/icon.png', [System.Drawing.Imaging.ImageFormat]::Png)

# Convert to ICO
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream('assets/icon.ico', [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$g.Dispose()
$bmp.Dispose()
Write-Host "Application icon created at assets/icon.ico and assets/icon.png"
