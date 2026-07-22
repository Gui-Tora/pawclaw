param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ArchivePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem

$resolvedArchive = (Resolve-Path -LiteralPath $ArchivePath).Path
if ([System.IO.Path]::GetExtension($resolvedArchive) -ne '.zip') {
  throw 'Expected the official comodo_dragon_ZIP.zip archive.'
}

$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$petDirectory = Join-Path $repositoryRoot 'pets\ember'
$spritesDirectory = Join-Path $petDirectory 'sprites'
$manifestPath = Join-Path $petDirectory 'pet.json'
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("pawclaw-ember-" + [Guid]::NewGuid().ToString('N'))

function Convert-GifToSpriteSheet {
  param(
    [Parameter(Mandatory = $true)][string]$GifPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$PreviewPath
  )

  $image = [System.Drawing.Image]::FromFile($GifPath)
  try {
    $dimension = New-Object System.Drawing.Imaging.FrameDimension($image.FrameDimensionsList[0])
    $frameCount = $image.GetFrameCount($dimension)
    $frameWidth = $image.Width
    $frameHeight = $image.Height
    $sheet = New-Object System.Drawing.Bitmap ($frameWidth * $frameCount), $frameHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($sheet)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        for ($frame = 0; $frame -lt $frameCount; $frame++) {
          [void]$image.SelectActiveFrame($dimension, $frame)
          $destination = New-Object System.Drawing.Rectangle ($frame * $frameWidth), 0, $frameWidth, $frameHeight
          $graphics.DrawImage($image, $destination, 0, 0, $frameWidth, $frameHeight, [System.Drawing.GraphicsUnit]::Pixel)
          if ($frame -eq 0 -and $PreviewPath) {
            $preview = New-Object System.Drawing.Bitmap $frameWidth, $frameHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
              $previewGraphics = [System.Drawing.Graphics]::FromImage($preview)
              try { $previewGraphics.DrawImageUnscaled($image, 0, 0) } finally { $previewGraphics.Dispose() }
              $preview.Save($PreviewPath, [System.Drawing.Imaging.ImageFormat]::Png)
            } finally { $preview.Dispose() }
          }
        }
      } finally { $graphics.Dispose() }
      $sheet.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $sheet.Dispose() }

    $delays = @()
    try {
      $frameDelay = $image.GetPropertyItem(0x5100).Value
      for ($index = 0; $index -lt [Math]::Min($frameCount, [Math]::Floor($frameDelay.Length / 4)); $index++) {
        $delay = [BitConverter]::ToInt32($frameDelay, $index * 4)
        if ($delay -gt 0) { $delays += $delay }
      }
    } catch {
      # Some encoders omit GIF frame delays; use a conservative default below.
    }
    $fps = if ($delays.Count -gt 0) {
      $averageDelay = ($delays | Measure-Object -Average).Average
      [Math]::Max(0.1, [Math]::Min(60, [Math]::Round(100 / $averageDelay, 2)))
    } else { 8 }

    return [PSCustomObject]@{
      frameWidth = $frameWidth
      frameHeight = $frameHeight
      frames = $frameCount
      fps = $fps
    }
  } finally { $image.Dispose() }
}

New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
try {
  $archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedArchive)
  try {
    foreach ($entry in $archive.Entries) {
      $normalized = $entry.FullName.Replace('\', '/')
      if ($normalized.StartsWith('/') -or $normalized.Split('/') -contains '..') {
        throw "Unsafe archive entry: $($entry.FullName)"
      }
    }
  } finally { $archive.Dispose() }

  [System.IO.Compression.ZipFile]::ExtractToDirectory($resolvedArchive, $temporaryDirectory)
  New-Item -ItemType Directory -Path $spritesDirectory -Force | Out-Null

  $mappings = @(
    [PSCustomObject]@{ state = 'idle'; pattern = 'idle'; output = 'idle.png'; loop = $true },
    [PSCustomObject]@{ state = 'walk'; pattern = 'run'; output = 'walk.png'; loop = $true },
    [PSCustomObject]@{ state = 'alert'; pattern = 'hit'; output = 'alert.png'; loop = $false }
  )
  $animations = [ordered]@{}
  $maximumFrameWidth = 1

  foreach ($mapping in $mappings) {
    $gif = Get-ChildItem -LiteralPath $temporaryDirectory -Recurse -File -Filter '*.gif' |
      Where-Object { $_.BaseName -match $mapping.pattern } |
      Select-Object -First 1
    if (-not $gif) { throw "The archive does not contain the expected $($mapping.pattern) GIF animation." }

    $outputPath = Join-Path $spritesDirectory $mapping.output
    $previewPath = if ($mapping.state -eq 'idle') { Join-Path $petDirectory 'preview.png' } else { $null }
    $metadata = Convert-GifToSpriteSheet -GifPath $gif.FullName -OutputPath $outputPath -PreviewPath $previewPath
    $maximumFrameWidth = [Math]::Max($maximumFrameWidth, $metadata.frameWidth)
    $animations[$mapping.state] = [ordered]@{
      src = "sprites/$($mapping.output)"
      frameWidth = $metadata.frameWidth
      frameHeight = $metadata.frameHeight
      frames = $metadata.frames
      fps = $metadata.fps
      loop = $mapping.loop
    }
  }

  $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
  $manifest.enabled = $true
  $manifest.preview = 'preview.png'
  $manifest.scale = [Math]::Max(1, [Math]::Min(4, [Math]::Floor(144 / $maximumFrameWidth)))
  $manifest.animations = [PSCustomObject]$animations
  $json = $manifest | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($manifestPath, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))

  Write-Host "Imported Ember sprites from $resolvedArchive"
  Write-Host "Credit retained: Originum - https://originum.itch.io/comodo-dragon"
} finally {
  if (Test-Path -LiteralPath $temporaryDirectory) {
    [System.IO.Directory]::Delete($temporaryDirectory, $true)
  }
}
