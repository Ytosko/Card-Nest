$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = Join-Path $projectRoot 'logos\logo.png'
$outputDirectory = Join-Path $projectRoot 'assets\images'

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw 'The Card Nest source logo is missing.'
}

[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null

function Export-CardNestAsset {
  param(
    [Parameter(Mandatory = $true)][string]$OutputName,
    [Parameter(Mandatory = $true)][int]$CanvasSize,
    [Parameter(Mandatory = $true)][int]$ArtworkSize
  )

  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $bitmap = New-Object System.Drawing.Bitmap($CanvasSize, $CanvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bitmap.SetResolution(144, 144)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $offset = [int](($CanvasSize - $ArtworkSize) / 2)
    $destination = New-Object System.Drawing.Rectangle($offset, $offset, $ArtworkSize, $ArtworkSize)
    $graphics.DrawImage($source, $destination)

    $outputPath = Join-Path $outputDirectory $OutputName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $source.Dispose()
  }
}

Export-CardNestAsset -OutputName 'cardnest-icon.png' -CanvasSize 1024 -ArtworkSize 1024
Export-CardNestAsset -OutputName 'cardnest-adaptive-foreground.png' -CanvasSize 1024 -ArtworkSize 640
Export-CardNestAsset -OutputName 'cardnest-splash.png' -CanvasSize 512 -ArtworkSize 420
Export-CardNestAsset -OutputName 'cardnest-favicon.png' -CanvasSize 256 -ArtworkSize 256

Write-Output 'Generated Card Nest brand assets from logos/logo.png.'
