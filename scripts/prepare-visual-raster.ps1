param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [Parameter(Mandatory = $true)]
  [string]$Destination,
  [Parameter(Mandatory = $true)]
  [int]$Width,
  [Parameter(Mandatory = $true)]
  [int]$Height,
  [ValidateRange(1, 100)]
  [int]$JpegQuality = 88
)

Add-Type -AssemblyName System.Drawing

$sourcePath = [System.IO.Path]::GetFullPath($Source)
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Source image does not exist: $sourcePath"
}

$destinationDirectory = Split-Path -Parent $destinationPath
[System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
try {
  $sourceRatio = $sourceImage.Width / $sourceImage.Height
  $targetRatio = $Width / $Height
  if ($sourceRatio -gt $targetRatio) {
    $cropHeight = $sourceImage.Height
    $cropWidth = [Math]::Round($cropHeight * $targetRatio)
    $cropX = [Math]::Round(($sourceImage.Width - $cropWidth) / 2)
    $cropY = 0
  } else {
    $cropWidth = $sourceImage.Width
    $cropHeight = [Math]::Round($cropWidth / $targetRatio)
    $cropX = 0
    $cropY = [Math]::Round(($sourceImage.Height - $cropHeight) / 2)
  }

  $outputImage = New-Object System.Drawing.Bitmap($Width, $Height)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($outputImage)
    try {
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($sourceImage, (New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)), $cropX, $cropY, $cropWidth, $cropHeight, [System.Drawing.GraphicsUnit]::Pixel)

      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
      $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]$JpegQuality)
      $outputImage.Save($destinationPath, $codec, $parameters)
    } finally {
      $graphics.Dispose()
    }
  } finally {
    $outputImage.Dispose()
  }
} finally {
  $sourceImage.Dispose()
}
