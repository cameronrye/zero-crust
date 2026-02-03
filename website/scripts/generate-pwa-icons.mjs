/* global Buffer, console */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG with background for better visibility
const svgWithBackground = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#0f172a"/>
  <path d="M25.16,70.9a8,8,0,0,1,2.7-11,193.49,193.49,0,0,1,200.28,0,8,8,0,0,1,2.7,11l-96,157.26a8,8,0,0,1-13.7,0Z" fill="none" stroke="#f97316" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
  <path d="M37.9,91.76a160.1,160.1,0,0,1,180.2,0" fill="none" stroke="#f97316" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
  <path d="M154,196.79a32,32,0,1,1,33.2-54.39" fill="none" stroke="#f97316" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
  <path d="M53.74,117.71a32,32,0,1,1,30.65,50" fill="none" stroke="#f97316" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
</svg>`;

// Maskable icon needs safe zone padding (icon content in center 80%)
const svgMaskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f172a"/>
  <g transform="translate(76.8, 76.8) scale(0.7)">
    <path d="M25.16,70.9a8,8,0,0,1,2.7-11,193.49,193.49,0,0,1,200.28,0,8,8,0,0,1,2.7,11l-96,157.26a8,8,0,0,1-13.7,0Z" fill="none" stroke="#f97316" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
    <path d="M37.9,91.76a160.1,160.1,0,0,1,180.2,0" fill="none" stroke="#f97316" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
    <path d="M154,196.79a32,32,0,1,1,33.2-54.39" fill="none" stroke="#f97316" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
    <path d="M53.74,117.71a32,32,0,1,1,30.65,50" fill="none" stroke="#f97316" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
  </g>
</svg>`;

async function generateIcons() {
  const svgBuffer = Buffer.from(svgWithBackground);
  const maskableBuffer = Buffer.from(svgMaskable);

  // Generate standard PWA icons
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // Generate maskable icon (for Android adaptive icons)
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // Generate Apple touch icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  console.log('All PWA icons generated successfully!');
}

generateIcons().catch(console.error);
