param(
  [switch]$RequireOcr
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $workspaceRoot 'apps\web\public\assets\v11'
$tsx = Join-Path $workspaceRoot 'apps\api\node_modules\.bin\tsx.cmd'
$manifestPrinter = Join-Path $PSScriptRoot 'print-v11-runtime-assets.ts'
$referenceRoots = @(
  (Join-Path $workspaceRoot 'docs\visual-references\v1.5-user-set-01'),
  (Join-Path $workspaceRoot 'docs\visual-references\v1.6-user-set-02')
)
$blacklist = @(
  '你的品牌名',
  'OLD STREET TEA BAR',
  'CUP · LEAF · STREET',
  'A WARM HELLO, WELL MADE',
  '三叁堂',
  '茶余',
  '简山',
  'TEASOUL',
  'Moshoan'
)
$failures = [System.Collections.Generic.List[string]]::new()
$reviews = [System.Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $tsx)) {
  throw "tsx runtime is missing: $tsx"
}

$manifest = (& $tsx $manifestPrinter | ConvertFrom-Json)
$assets = @($manifest.runtimeAssets | Where-Object { $_.path -match '\.(jpg|jpeg|png|webp)$' })
if ($assets.Count -eq 0) {
  $failures.Add('Runtime raster manifest is empty.')
}

$paths = @($assets.path)
if (($paths | Select-Object -Unique).Count -ne $paths.Count) {
  $failures.Add('Runtime raster manifest contains duplicate paths.')
}

function Get-ImageRecord {
  param([string]$RelativePath, [string]$Family)

  $absolutePath = Join-Path $assetRoot $RelativePath
  if (-not (Test-Path -LiteralPath $absolutePath)) {
    $failures.Add("${RelativePath}: missing runtime file")
    return $null
  }

  $image = [System.Drawing.Image]::FromFile($absolutePath)
  try {
    if ($Family -in @('scene', 'action', 'result') -and $image.Width * 9 -ne $image.Height * 16) {
      $failures.Add("${RelativePath}: $Family must be 16:9, got $($image.Width)x$($image.Height)")
    }
    if ($image.Width -lt 640 -or $image.Height -lt 360) {
      $failures.Add("${RelativePath}: raster is too small at $($image.Width)x$($image.Height)")
    }

    $thumbnail = [System.Drawing.Bitmap]::new(16, 16)
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($thumbnail)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($image, 0, 0, 16, 16)
      } finally {
        $graphics.Dispose()
      }

      $pixels = [double[]]::new(256)
      $total = 0.0
      $index = 0
      for ($y = 0; $y -lt 16; $y += 1) {
        for ($x = 0; $x -lt 16; $x += 1) {
          $color = $thumbnail.GetPixel($x, $y)
          $value = 0.299 * $color.R + 0.587 * $color.G + 0.114 * $color.B
          $pixels[$index] = $value
          $total += $value
          $index += 1
        }
      }
      $mean = $total / $pixels.Length
      $fingerprint = -join ($pixels | ForEach-Object { if ($_ -ge $mean) { '1' } else { '0' } })
      return [PSCustomObject]@{
        Path = $RelativePath
        Family = $Family
        Width = $image.Width
        Height = $image.Height
        Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $absolutePath).Hash
        Pixels = $pixels
        Fingerprint = $fingerprint
      }
    } finally {
      $thumbnail.Dispose()
    }
  } finally {
    $image.Dispose()
  }
}

function Get-HammingDistance {
  param([string]$Left, [string]$Right)

  $distance = 0
  for ($index = 0; $index -lt $Left.Length; $index += 1) {
    if ($Left[$index] -ne $Right[$index]) { $distance += 1 }
  }
  return $distance
}

function Get-SsimScore {
  param([double[]]$Left, [double[]]$Right)

  $leftMean = ($Left | Measure-Object -Average).Average
  $rightMean = ($Right | Measure-Object -Average).Average
  $leftVariance = 0.0
  $rightVariance = 0.0
  $covariance = 0.0
  for ($index = 0; $index -lt $Left.Length; $index += 1) {
    $leftDelta = $Left[$index] - $leftMean
    $rightDelta = $Right[$index] - $rightMean
    $leftVariance += $leftDelta * $leftDelta
    $rightVariance += $rightDelta * $rightDelta
    $covariance += $leftDelta * $rightDelta
  }
  $denominator = [Math]::Max(1, $Left.Length - 1)
  $leftVariance /= $denominator
  $rightVariance /= $denominator
  $covariance /= $denominator
  $c1 = [Math]::Pow(0.01 * 255, 2)
  $c2 = [Math]::Pow(0.03 * 255, 2)
  return ((2 * $leftMean * $rightMean + $c1) * (2 * $covariance + $c2)) /
    (($leftMean * $leftMean + $rightMean * $rightMean + $c1) * ($leftVariance + $rightVariance + $c2))
}

$decodableAssets = @($assets | Where-Object { $_.path -match '\.(jpg|jpeg|png)$' })
$opaqueAssets = @($assets | Where-Object { $_.path -match '\.webp$' })
$records = @($decodableAssets | ForEach-Object { Get-ImageRecord -RelativePath $_.path -Family $_.family } | Where-Object { $_ })
$hashes = @{}
foreach ($record in $records) {
  if ($hashes.ContainsKey($record.Hash)) {
    $failures.Add("$($record.Path): exact duplicate of $($hashes[$record.Hash])")
  } else {
    $hashes[$record.Hash] = $record.Path
  }
}
foreach ($asset in $opaqueAssets) {
  $absolutePath = Join-Path $assetRoot $asset.path
  if (-not (Test-Path -LiteralPath $absolutePath)) {
    $failures.Add("$($asset.path): missing runtime file")
    continue
  }
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $absolutePath).Hash
  if ($hashes.ContainsKey($hash)) {
    $failures.Add("$($asset.path): exact duplicate of $($hashes[$hash])")
  } else {
    $hashes[$hash] = $asset.path
  }
}

# Reference files live outside the runtime asset root, so load their fingerprints independently.
$referenceRecords = @()
foreach ($referenceRoot in $referenceRoots) {
  if (-not (Test-Path -LiteralPath $referenceRoot)) { continue }
  foreach ($reference in Get-ChildItem -LiteralPath $referenceRoot -Recurse -File | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' }) {
    $image = [System.Drawing.Image]::FromFile($reference.FullName)
    try {
      $thumbnail = [System.Drawing.Bitmap]::new(16, 16)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($thumbnail)
        try { $graphics.DrawImage($image, 0, 0, 16, 16) } finally { $graphics.Dispose() }
        $pixels = [double[]]::new(256)
        $total = 0.0
        $index = 0
        for ($y = 0; $y -lt 16; $y += 1) {
          for ($x = 0; $x -lt 16; $x += 1) {
            $color = $thumbnail.GetPixel($x, $y)
            $pixels[$index] = 0.299 * $color.R + 0.587 * $color.G + 0.114 * $color.B
            $total += $pixels[$index]
            $index += 1
          }
        }
        $mean = $total / $pixels.Length
        $referenceRecords += [PSCustomObject]@{
          Path = $reference.FullName
          Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $reference.FullName).Hash
          Pixels = $pixels
          Fingerprint = -join ($pixels | ForEach-Object { if ($_ -ge $mean) { '1' } else { '0' } })
        }
      } finally { $thumbnail.Dispose() }
    } finally { $image.Dispose() }
  }
}

for ($left = 0; $left -lt $records.Count; $left += 1) {
  for ($right = $left + 1; $right -lt $records.Count; $right += 1) {
    $hamming = Get-HammingDistance $records[$left].Fingerprint $records[$right].Fingerprint
    $ssim = Get-SsimScore $records[$left].Pixels $records[$right].Pixels
    if ($hamming -le 10 -or $ssim -ge 0.985) {
      $reviews.Add("near runtime pair: $($records[$left].Path) <> $($records[$right].Path) (hamming $hamming, SSIM $([Math]::Round($ssim, 4)))")
    }
  }
  foreach ($reference in $referenceRecords) {
    if ($records[$left].Hash -eq $reference.Hash) {
      $failures.Add("$($records[$left].Path): exact reference reuse detected")
      continue
    }
    $hamming = Get-HammingDistance $records[$left].Fingerprint $reference.Fingerprint
    $ssim = Get-SsimScore $records[$left].Pixels $reference.Pixels
    if ($hamming -le 10 -or $ssim -ge 0.985) {
      $failures.Add("$($records[$left].Path): too close to reference $($reference.Path) (hamming $hamming, SSIM $([Math]::Round($ssim, 4)))")
    }
  }
}

$textFiles = Get-ChildItem -LiteralPath (Join-Path $workspaceRoot 'apps\web\src') -Recurse -File |
  Where-Object { $_.Extension -in @('.ts', '.tsx', '.css') -and $_.Name -notmatch '\.test\.' }
foreach ($term in $blacklist) {
  $hits = $textFiles | Select-String -SimpleMatch -Pattern $term
  if ($hits) { $failures.Add("Runtime source contains blocked placeholder or brand text: $term") }
}

$ocr = Get-Command tesseract -ErrorAction SilentlyContinue
if ($RequireOcr -and -not $ocr) {
  $failures.Add('OCR was required but tesseract is not installed.')
} elseif ($ocr) {
  Write-Host "OCR engine detected at $($ocr.Source); run its language-configured scan before release."
} else {
  Write-Host 'OCR binary not installed; visual text review remains a documented manual release check.'
}

Write-Host "Audited $($records.Count) decoded runtime rasters, $($opaqueAssets.Count) WebP runtime files, and $($referenceRecords.Count) reference rasters."
foreach ($review in $reviews) { Write-Host "REVIEW: $review" }
foreach ($failure in $failures) { Write-Error "FAIL: $failure" }
if ($failures.Count -gt 0) { exit 1 }
