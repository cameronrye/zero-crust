#!/usr/bin/env node
/**
 * Icon Generation Script for Zero Crust POS
 *
 * Converts the source SVG to all required icon formats for Electron:
 * - macOS: .icns (512x512 and 1024x1024 for Retina)
 * - Windows: .ico (multi-size: 16, 24, 32, 48, 64, 128, 256)
 * - Linux: .png (256x256 and 512x512)
 *
 * The script adds proper padding and a background color to ensure
 * the icon looks native on all platforms.
 *
 * Usage: node scripts/generate-icons.mjs [options]
 *
 * Options:
 *   --background <color>  Background color (default: #f97316 - orange-500)
 *                         Use 'transparent' for no background
 *   --stroke <color>      Stroke color for the icon (default: #ffffff)
 *   --padding <percent>   Padding as percentage of icon size (default: 20)
 *
 * Requirements:
 *   - sharp (npm install sharp)
 *   - png2icons (npm install png2icons) - for .ico and .icns generation
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const SOURCE_SVG = path.join(ASSETS_DIR, 'logo.svg');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
};

const BACKGROUND_COLOR = getArg('background', 'transparent'); // Transparent for native look
const STROKE_COLOR = getArg('stroke', '#f97316'); // Tailwind orange-500 (pizza-themed!)
const PADDING_PERCENT = parseFloat(getArg('padding', '15')); // Percentage of icon size for padding
const GLOW_COLOR = getArg('glow', '#f97316'); // Glow color (defaults to stroke color)
const GLOW_INTENSITY = parseFloat(getArg('glow-intensity', '3')); // Glow blur radius

// Icon sizes needed for each platform
const ICON_SIZES = {
  // Windows ICO needs multiple sizes embedded
  ico: [16, 24, 32, 48, 64, 128, 256],
  // macOS ICNS sizes (including @2x variants)
  icns: [16, 32, 64, 128, 256, 512, 1024],
  // Linux PNG sizes
  png: [16, 32, 48, 64, 128, 256, 512],
  // Tray icon sizes (menu bar / system tray)
  tray: [16, 32], // 16x16 standard, 32x32 for @2x Retina
};

async function main() {
  console.log('🍕 Zero Crust Icon Generator\n');
  console.log(`  Source: ${SOURCE_SVG}`);
  console.log(`  Background: ${BACKGROUND_COLOR}`);
  console.log(`  Stroke: ${STROKE_COLOR}`);
  console.log(`  Glow: ${GLOW_COLOR} (intensity: ${GLOW_INTENSITY})`);
  console.log(`  Padding: ${PADDING_PERCENT}%\n`);

  // Check if source SVG exists
  if (!fs.existsSync(SOURCE_SVG)) {
    console.error(`❌ Source SVG not found: ${SOURCE_SVG}`);
    process.exit(1);
  }

  // Dynamically import sharp (ES module)
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('❌ sharp is not installed. Run: pnpm add -D sharp');
    process.exit(1);
  }

  // Read and modify SVG with custom colors and padding
  let svgContent = fs.readFileSync(SOURCE_SVG, 'utf-8');

  // Replace stroke color in SVG
  svgContent = svgContent.replace(/stroke="#[a-fA-F0-9]{6}"/g, `stroke="${STROKE_COLOR}"`);

  // Calculate padding and scaling
  const iconSize = 256;
  const padding = (iconSize * PADDING_PERCENT) / 100;
  const contentSize = iconSize - padding * 2;
  const scale = contentSize / iconSize;

  // Create the glow filter definition
  const glowFilter = `
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="${GLOW_INTENSITY}" result="blur"/>
        <feFlood flood-color="${GLOW_COLOR}" flood-opacity="0.8" result="glowColor"/>
        <feComposite in="glowColor" in2="blur" operator="in" result="softGlow"/>
        <feMerge>
          <feMergeNode in="softGlow"/>
          <feMergeNode in="softGlow"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>`;

  // Add background rect and wrap content in a group with transform for padding and glow
  if (BACKGROUND_COLOR !== 'transparent') {
    // Remove the empty rect and wrap paths in a scaled/translated group with glow
    svgContent = svgContent.replace(
      /<rect width="256" height="256" fill="none"\/>/,
      `${glowFilter}<rect width="256" height="256" fill="${BACKGROUND_COLOR}" rx="48" ry="48"/><g transform="translate(${padding}, ${padding}) scale(${scale})" filter="url(#glow)">`
    );
    // Close the group before closing svg tag
    svgContent = svgContent.replace(/<\/svg>/, '</g></svg>');
  } else {
    // Transparent background with padding and glow
    svgContent = svgContent.replace(
      /<rect width="256" height="256" fill="none"\/>/,
      `${glowFilter}<rect width="256" height="256" fill="none"/><g transform="translate(${padding}, ${padding}) scale(${scale})" filter="url(#glow)">`
    );
    svgContent = svgContent.replace(/<\/svg>/, '</g></svg>');
  }

  // Create a temporary directory for intermediate files
  const tempDir = path.join(ASSETS_DIR, '.icon-temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Save modified SVG temporarily
  const tempSvg = path.join(tempDir, 'icon-source.svg');
  fs.writeFileSync(tempSvg, svgContent);

  console.log('📐 Generating PNG files at various sizes...\n');

  // Generate PNGs at all required sizes
  const allSizes = [...new Set([...ICON_SIZES.ico, ...ICON_SIZES.icns, ...ICON_SIZES.png])].sort(
    (a, b) => a - b
  );

  for (const size of allSizes) {
    const outputPath = path.join(tempDir, `icon-${size}.png`);
    await sharp(Buffer.from(svgContent))
      .resize(size, size, {
        fit: 'contain',
        background: BACKGROUND_COLOR === 'transparent' ? { r: 0, g: 0, b: 0, alpha: 0 } : BACKGROUND_COLOR,
      })
      .png()
      .toFile(outputPath);
    console.log(`  ✓ Generated ${size}x${size} PNG`);
  }

  // Generate the main icon.png for Linux (256x256)
  const mainPng = path.join(ASSETS_DIR, 'icon.png');
  await sharp(Buffer.from(svgContent))
    .resize(256, 256, {
      fit: 'contain',
      background: BACKGROUND_COLOR === 'transparent' ? { r: 0, g: 0, b: 0, alpha: 0 } : BACKGROUND_COLOR,
    })
    .png()
    .toFile(mainPng);
  console.log(`\n✓ Created ${mainPng}`);

  // Generate 1024x1024 master PNG for icon generation tools
  const masterPng = path.join(tempDir, 'icon-1024.png');
  await sharp(Buffer.from(svgContent))
    .resize(1024, 1024, {
      fit: 'contain',
      background: BACKGROUND_COLOR === 'transparent' ? { r: 0, g: 0, b: 0, alpha: 0 } : BACKGROUND_COLOR,
    })
    .png()
    .toFile(masterPng);

  // Generate ICO and ICNS using png2icons or electron-icon-builder
  console.log('\n📦 Generating platform-specific icons...\n');

  try {
    // Try using electron-icon-builder first (more reliable)
    execSync(`npx electron-icon-builder --input="${masterPng}" --output="${ASSETS_DIR}" --flatten`, {
      stdio: 'inherit',
    });
    console.log('\n✓ Generated icons using electron-icon-builder');

    // electron-icon-builder puts files in assets/icons/, move them to assets/
    const iconsSubdir = path.join(ASSETS_DIR, 'icons');
    if (fs.existsSync(iconsSubdir)) {
      const icoPath = path.join(iconsSubdir, 'icon.ico');
      const icnsPath = path.join(iconsSubdir, 'icon.icns');
      if (fs.existsSync(icoPath)) {
        fs.copyFileSync(icoPath, path.join(ASSETS_DIR, 'icon.ico'));
      }
      if (fs.existsSync(icnsPath)) {
        fs.copyFileSync(icnsPath, path.join(ASSETS_DIR, 'icon.icns'));
      }
    }
  } catch {
    console.log('  electron-icon-builder not available, trying alternative methods...');
    await generateIconsManually(sharp, tempDir, svgContent);
  }

  // Cleanup temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });

  // Cleanup icons subdirectory (we've copied what we need)
  const iconsSubdir = path.join(ASSETS_DIR, 'icons');
  if (fs.existsSync(iconsSubdir)) {
    fs.rmSync(iconsSubdir, { recursive: true, force: true });
  }

  // Generate tray icons for menu bar / system tray
  console.log('\n📱 Generating tray icons...\n');
  await generateTrayIcons(sharp);

  console.log('\n✅ Icon generation complete!\n');
  console.log('Generated files:');
  console.log(`  - ${path.join(ASSETS_DIR, 'icon.png')} (Linux)`);
  console.log(`  - ${path.join(ASSETS_DIR, 'icon.ico')} (Windows)`);
  console.log(`  - ${path.join(ASSETS_DIR, 'icon.icns')} (macOS)`);
  console.log(`  - ${path.join(ASSETS_DIR, 'trayTemplate.png')} (macOS menu bar)`);
  console.log(`  - ${path.join(ASSETS_DIR, 'trayTemplate@2x.png')} (macOS menu bar Retina)`);
}

async function generateIconsManually(sharp, tempDir, svgContent) {
  console.log('  Using manual icon generation...');

  // Generate ICO for Windows using png-to-ico
  try {
    const pngToIco = (await import('png-to-ico')).default;
    const icoSizes = ICON_SIZES.ico;
    const pngBuffers = await Promise.all(
      icoSizes.map((size) =>
        sharp(Buffer.from(svgContent))
          .resize(size, size)
          .png()
          .toBuffer()
      )
    );
    const icoBuffer = await pngToIco(pngBuffers);
    fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), icoBuffer);
    console.log('  ✓ Generated icon.ico');
  } catch (err) {
    console.warn('  ⚠ Could not generate ICO:', err.message);
    console.warn('    Install png-to-ico: pnpm add -D png-to-ico');
  }

  // Generate ICNS for macOS using iconutil (macOS only)
  if (process.platform === 'darwin') {
    try {
      const iconsetDir = path.join(tempDir, 'icon.iconset');
      fs.mkdirSync(iconsetDir, { recursive: true });

      // macOS iconset requires specific naming convention
      const iconsetSizes = [
        { size: 16, name: 'icon_16x16.png' },
        { size: 32, name: 'icon_16x16@2x.png' },
        { size: 32, name: 'icon_32x32.png' },
        { size: 64, name: 'icon_32x32@2x.png' },
        { size: 128, name: 'icon_128x128.png' },
        { size: 256, name: 'icon_128x128@2x.png' },
        { size: 256, name: 'icon_256x256.png' },
        { size: 512, name: 'icon_256x256@2x.png' },
        { size: 512, name: 'icon_512x512.png' },
        { size: 1024, name: 'icon_512x512@2x.png' },
      ];

      for (const { size, name } of iconsetSizes) {
        await sharp(Buffer.from(svgContent))
          .resize(size, size)
          .png()
          .toFile(path.join(iconsetDir, name));
      }

      execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(ASSETS_DIR, 'icon.icns')}"`, {
        stdio: 'pipe',
      });
      console.log('  ✓ Generated icon.icns');
    } catch (err) {
      console.warn('  ⚠ Could not generate ICNS:', err.message);
    }
  } else {
    console.log('  ℹ Skipping ICNS generation (not on macOS)');
    console.log('    To generate ICNS, run this script on macOS or use electron-icon-builder');
  }
}

/**
 * Generate tray icons for menu bar / system tray
 *
 * macOS menu bar icons should be "template images" - monochrome icons that
 * the system automatically inverts based on the menu bar appearance (light/dark).
 * The naming convention "Template" in the filename tells Electron to treat it as such.
 *
 * Sizes:
 * - 16x16 for standard displays
 * - 32x32 (@2x) for Retina displays
 */
async function generateTrayIcons(sharp) {
  // Read the source SVG
  let svgContent = fs.readFileSync(SOURCE_SVG, 'utf-8');

  // For template images, we need a monochrome icon (black with transparency)
  // The system will invert it as needed for light/dark mode
  // Use black (#000000) for the stroke - macOS will handle the rest
  const templateStrokeColor = '#000000';

  // Replace stroke color for template image
  svgContent = svgContent.replace(/stroke="#[a-fA-F0-9]{6}"/g, `stroke="${templateStrokeColor}"`);

  // Remove any fill colors and make background transparent
  svgContent = svgContent.replace(/fill="#[a-fA-F0-9]{6}"/g, 'fill="none"');

  // Add padding for tray icon (smaller padding for small icons)
  const trayPadding = 10; // percentage
  const iconSize = 256; // base size for SVG
  const padding = (iconSize * trayPadding) / 100;
  const contentSize = iconSize - padding * 2;
  const scale = contentSize / iconSize;

  // Wrap content in a scaled/translated group for padding (no glow for template)
  svgContent = svgContent.replace(
    /<rect width="256" height="256" fill="none"\/>/,
    `<rect width="256" height="256" fill="none"/><g transform="translate(${padding}, ${padding}) scale(${scale})">`
  );
  svgContent = svgContent.replace(/<\/svg>/, '</g></svg>');

  // Generate 16x16 tray icon (standard)
  const tray16Path = path.join(ASSETS_DIR, 'trayTemplate.png');
  await sharp(Buffer.from(svgContent))
    .resize(16, 16, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(tray16Path);
  console.log('  ✓ Generated trayTemplate.png (16x16)');

  // Generate 32x32 tray icon (@2x for Retina)
  const tray32Path = path.join(ASSETS_DIR, 'trayTemplate@2x.png');
  await sharp(Buffer.from(svgContent))
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(tray32Path);
  console.log('  ✓ Generated trayTemplate@2x.png (32x32)');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

