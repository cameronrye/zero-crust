#!/usr/bin/env node
/**
 * Loading GIF Generator for Zero Crust Windows Installer
 *
 * Creates an animated loading GIF for the Squirrel.Windows installer.
 * The GIF features a pulsing logo with "Installing..." text.
 *
 * Usage: node scripts/generate-loading-gif.mjs
 *
 * Requirements:
 *   - sharp (npm install sharp)
 *   - gif-encoder-2 (npm install gif-encoder-2)
 *   - canvas (npm install canvas)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const SOURCE_SVG = path.join(ASSETS_DIR, 'logo.svg');
const OUTPUT_GIF = path.join(ASSETS_DIR, 'installer-loading.gif');

// Configuration
const WIDTH = 500;
const HEIGHT = 300;
const FRAME_COUNT = 60; // 60 frames for smooth animation
const FRAME_DELAY = 33; // ~30fps (delay in ms)
const BRAND_COLOR = '#f97316'; // Tailwind orange-500

async function main() {
  console.log('Zero Crust Loading GIF Generator\n');
  console.log(`  Output: ${OUTPUT_GIF}`);
  console.log(`  Dimensions: ${WIDTH}x${HEIGHT}`);
  console.log(`  Frames: ${FRAME_COUNT}`);
  console.log(`  Frame delay: ${FRAME_DELAY}ms (~${Math.round(1000 / FRAME_DELAY)}fps)\n`);

  // Check dependencies
  let sharp, GIFEncoder, createCanvas;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('sharp is not installed. Run: pnpm add -D sharp');
    process.exit(1);
  }
  try {
    GIFEncoder = (await import('gif-encoder-2')).default;
  } catch {
    console.error('gif-encoder-2 is not installed. Run: pnpm add -D gif-encoder-2');
    process.exit(1);
  }
  try {
    const canvasModule = await import('canvas');
    createCanvas = canvasModule.createCanvas;
  } catch {
    console.error('canvas is not installed. Run: pnpm add -D canvas');
    process.exit(1);
  }

  // Check source SVG
  if (!fs.existsSync(SOURCE_SVG)) {
    console.error(`Source SVG not found: ${SOURCE_SVG}`);
    process.exit(1);
  }

  // Read and prepare logo SVG
  let svgContent = fs.readFileSync(SOURCE_SVG, 'utf-8');

  // Generate base logo PNG at 120x120 (will be scaled for pulse effect)
  const logoSize = 120;
  const logoBuffer = await sharp(Buffer.from(svgContent))
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Create GIF encoder
  const encoder = new GIFEncoder(WIDTH, HEIGHT);
  encoder.setDelay(FRAME_DELAY);
  encoder.setRepeat(0); // Loop forever
  encoder.setTransparent(0x000000); // Black as transparent
  encoder.start();

  console.log('Generating frames...');

  // Generate each frame
  for (let i = 0; i < FRAME_COUNT; i++) {
    const progress = i / FRAME_COUNT;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Clear with transparent background
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Calculate pulse scale (0.9 to 1.1)
    const pulseScale = 1 + 0.1 * Math.sin(progress * Math.PI * 2);

    // Draw pulsing logo
    const scaledSize = logoSize * pulseScale;
    const logoX = (WIDTH - scaledSize) / 2;
    const logoY = (HEIGHT - scaledSize) / 2 - 30;

    // Load logo image from buffer
    const { loadImage } = await import('canvas');
    const logoImage = await loadImage(logoBuffer);
    ctx.drawImage(logoImage, logoX, logoY, scaledSize, scaledSize);

    // Draw "Installing..." text with animated dots
    const dotCount = Math.floor((progress * 3) % 4);
    const dots = '.'.repeat(dotCount);
    const text = `Installing${dots}`;

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = BRAND_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, WIDTH / 2, HEIGHT / 2 + 70);

    // Add frame to GIF
    encoder.addFrame(ctx);

    if ((i + 1) % 10 === 0) {
      console.log(`  Frame ${i + 1}/${FRAME_COUNT}`);
    }
  }

  encoder.finish();

  // Write GIF to file
  const gifBuffer = encoder.out.getData();
  fs.writeFileSync(OUTPUT_GIF, gifBuffer);

  const fileSizeKB = Math.round(fs.statSync(OUTPUT_GIF).size / 1024);
  console.log(`\n✅ Generated ${OUTPUT_GIF}`);
  console.log(`   File size: ${fileSizeKB} KB`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

