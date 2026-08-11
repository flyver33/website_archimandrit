# =============================================================================
#  Сжатие икон календаря: Викисклад отдаёт уменьшенные копии в высоком качестве,
#  по полмегабайта на файл. Для карточки шириной около 500 пикселей это лишнее.
#
#  Запуск:  powershell -ExecutionPolicy Bypass -File tools/compress-images.ps1
#  По умолчанию правит assets/img/feasts на месте: ширина до 640, качество 78.
# =============================================================================

param(
  [string]$Path = "assets/img/feasts",
  [int]$MaxWidth = 640,
  [int]$Quality = 78
)

Add-Type -AssemblyName System.Drawing

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq 'image/jpeg' }

$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [int64]$Quality)

$before = 0
$after = 0

foreach ($file in Get-ChildItem -Path $Path -Filter *.jpg) {
  $before += $file.Length

  $src = [System.Drawing.Image]::FromFile($file.FullName)

  $w = [Math]::Min($MaxWidth, $src.Width)
  $h = [int][Math]::Round($src.Height * ($w / $src.Width))

  $dst = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose()
  $src.Dispose()

  # Пишем во временный файл: исходный ещё занят до Dispose
  $tmp = "$($file.FullName).tmp"
  $dst.Save($tmp, $codec, $params)
  $dst.Dispose()

  Move-Item -Path $tmp -Destination $file.FullName -Force
  $after += (Get-Item $file.FullName).Length
}

$mb = { param($b) [Math]::Round($b / 1MB, 1) }
Write-Output ("Было: " + (& $mb $before) + " МБ, стало: " + (& $mb $after) + " МБ")
