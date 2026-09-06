param(
  [string]$OcrTessdataDir = $env:V11_OCR_TESSDATA_DIR
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $workspaceRoot 'apps\web\public\assets\v11'
$tsx = Join-Path $workspaceRoot 'apps\api\node_modules\.bin\tsx.cmd'
$manifestPrinter = Join-Path $PSScriptRoot 'print-v11-runtime-assets.ts'
$ocrConfig = Join-Path $PSScriptRoot 'tesseract-tsv.config'
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

foreach ($asset in $assets) {
  $focalPoint = $asset.focalPoint
  if ($null -eq $focalPoint) {
    $failures.Add("$($asset.path): missing focalPoint metadata")
    continue
  }
  if ($null -eq $focalPoint.x -or $null -eq $focalPoint.y -or
    $focalPoint.x -lt 0 -or $focalPoint.x -gt 100 -or
    $focalPoint.y -lt 0 -or $focalPoint.y -gt 100) {
    $failures.Add("$($asset.path): focalPoint must stay inside the source image")
  }
}

function Get-ExpectedImageDimensions {
  param([string]$Family)

  switch ($Family) {
    'scene' { return @(1280, 720) }
    'chapter' { return @(1280, 720) }
    'result' { return @(1280, 720) }
    'action' { return @(800, 600) }
    'decision' { return @(800, 600) }
    'touchpoint' { return @(1000, 750) }
    default { throw "Unknown visual asset family: $Family" }
  }
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
    $expectedDimensions = Get-ExpectedImageDimensions -Family $Family
    if ($image.Width -ne $expectedDimensions[0] -or $image.Height -ne $expectedDimensions[1]) {
      $failures.Add("${RelativePath}: $Family runtime size must be $($expectedDimensions[0])x$($expectedDimensions[1]), got $($image.Width)x$($image.Height)")
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
if (-not $ocr) {
  $ocr = Get-Item 'C:\Program Files\Tesseract-OCR\tesseract.exe' -ErrorAction SilentlyContinue
}
if (-not $ocr) {
  $failures.Add('OCR release gate requires tesseract, but no executable was found.')
} else {
  $ocrPath = if ($ocr -is [System.Management.Automation.CommandInfo]) { $ocr.Source } else { $ocr.FullName }
  if ([string]::IsNullOrWhiteSpace($OcrTessdataDir)) {
    $OcrTessdataDir = Join-Path $env:LOCALAPPDATA 'Tesseract-OCR\tessdata'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $OcrTessdataDir 'eng.traineddata')) -or
    -not (Test-Path -LiteralPath (Join-Path $OcrTessdataDir 'chi_sim.traineddata'))) {
    $failures.Add("OCR release gate requires eng and chi_sim traineddata under $OcrTessdataDir")
  } else {
    foreach ($record in $records) {
      $absolutePath = Join-Path $assetRoot $record.Path
      $ocrOutput = & $ocrPath $absolutePath stdout --tessdata-dir $OcrTessdataDir -l eng+chi_sim --psm 11 $ocrConfig 2>&1
      if ($LASTEXITCODE -ne 0) {
        $failures.Add("$($record.Path): OCR scan failed")
        continue
      }
      $ocrWords = @(
        $ocrOutput | ConvertFrom-Csv -Delimiter "`t" | Where-Object {
          $_.level -eq '5' -and
          -not [string]::IsNullOrWhiteSpace($_.text) -and
          [double]$_.conf -ge 60
        }
      )
      $recognizedText = (($ocrWords.text -join ' ') -replace '\s+', ' ').Trim()
      if ([string]::IsNullOrWhiteSpace($recognizedText)) { continue }
      foreach ($term in $blacklist) {
        if ($recognizedText.Contains($term, [System.StringComparison]::OrdinalIgnoreCase)) {
          $failures.Add("$($record.Path): OCR detected blocked text: $term")
        }
      }
      $highConfidenceText = (($ocrWords | Where-Object { [double]$_.conf -ge 80 }).text -join ' ')
      $latinWords = [regex]::Matches($highConfidenceText, '(?i)\b[a-z]{3,}\b') |
        ForEach-Object { $_.Value } | Select-Object -Unique
      if ($latinWords.Count -gt 0) {
        $failures.Add("$($record.Path): OCR detected unexpected Latin text: $($latinWords -join ', ')")
      }
      if ($highConfidenceText -match '[一-鿿]{2,}') {
        $failures.Add("$($record.Path): OCR detected unexpected readable Chinese text: $highConfidenceText")
      }
    }
  }
}

Write-Host "Audited $($records.Count) decoded runtime rasters, $($opaqueAssets.Count) WebP runtime files, and $($referenceRecords.Count) reference rasters."
foreach ($review in $reviews) { Write-Host "REVIEW: $review" }
foreach ($failure in $failures) { Write-Error "FAIL: $failure" }
if ($failures.Count -gt 0) { exit 1 }
