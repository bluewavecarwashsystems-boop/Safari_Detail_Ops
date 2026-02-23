/**
 * PWA Icon Generation Script (Node.js)
 * No external dependencies required - uses sharp (included with Next.js)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_IMAGE = path.join(__dirname, '..', 'public', 'safari-logo.png');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  try {
    // Check if source image exists
    if (!fs.existsSync(SOURCE_IMAGE)) {
      console.error('❌ Error: Source image not found at:', SOURCE_IMAGE);
      console.log('Please ensure safari-logo.png exists in the public/ folder');
      process.exit(1);
    }

    // Generate 192x192 icon
    console.log('📱 Generating icon-192.png...');
    await sharp(SOURCE_IMAGE)
      .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'icon-192.png'));

    // Generate 512x512 icon
    console.log('📱 Generating icon-512.png...');
    await sharp(SOURCE_IMAGE)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'icon-512.png'));

    // Generate 512x512 maskable icon (with safe zone padding)
    console.log('📱 Generating icon-512-maskable.png (with safe zone)...');
    await sharp(SOURCE_IMAGE)
      .resize(308, 308, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .extend({
        top: 102,
        bottom: 102,
        left: 102,
        right: 102,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(path.join(PUBLIC_DIR, 'icon-512-maskable.png'));

    console.log('\n✅ PWA icons generated successfully!\n');
    console.log('Generated files:');
    console.log('  - public/icon-192.png (192x192)');
    console.log('  - public/icon-512.png (512x512)');
    console.log('  - public/icon-512-maskable.png (512x512 with safe zone)\n');
    console.log('Next steps:');
    console.log('  1. Verify icons look correct');
    console.log('  2. Test maskable icon at https://maskable.app/');
    console.log('  3. Commit and deploy\n');

  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    
    if (error.message.includes('sharp')) {
      console.log('\n💡 Sharp module not found. Installing...');
      console.log('Run: npm install sharp');
      console.log('Then try again: node scripts/generate-pwa-icons.js\n');
    }
    
    process.exit(1);
  }
}

generateIcons();
