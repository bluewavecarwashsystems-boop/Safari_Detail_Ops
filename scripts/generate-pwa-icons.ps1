# PWA Icon Generation Script
# Requires ImageMagick: https://imagemagick.org/

# Set source image
$sourceImage = "public/safari-logo.png"

# Create 192x192 icon
magick convert $sourceImage -resize 192x192 -quality 100 public/icon-192.png

# Create 512x512 icon
magick convert $sourceImage -resize 512x512 -quality 100 public/icon-512.png

# Create 512x512 maskable icon (with padding for safe zone)
# Maskable icons need 40% safe zone (204px on each side for 512px icon)
magick convert $sourceImage -resize 308x308 -gravity center -extent 512x512 -quality 100 public/icon-512-maskable.png

Write-Host "PWA icons generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Generated files:" -ForegroundColor Cyan
Write-Host "  - public/icon-192.png (192x192)" -ForegroundColor Gray
Write-Host "  - public/icon-512.png (512x512)" -ForegroundColor Gray
Write-Host "  - public/icon-512-maskable.png (512x512 with safe zone)" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify icons look correct" -ForegroundColor Gray
Write-Host "  2. Test maskable icon at https://maskable.app/" -ForegroundColor Gray
Write-Host "  3. Commit and deploy" -ForegroundColor Gray
