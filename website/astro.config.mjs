import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';
import critters from 'astro-critters';

export default defineConfig({
  site: 'https://zerocrust.net',
  integrations: [
    sitemap(),
    react(),
    critters(),
    AstroPWA({
      mode: 'production',
      base: '/',
      scope: '/',
      includeAssets: ['favicon.svg', 'og-image.png', 'apple-touch-icon.png', 'screenshots/*.png', 'screenshots/*.webp'],
      registerType: 'autoUpdate',
      manifest: {
        id: '/demo',
        name: 'Zero Crust POS Demo',
        short_name: 'Zero Crust',
        description: 'Interactive POS simulator demonstrating dual-window architecture',
        theme_color: '#f97316',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/demo',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/cashier.png',
            sizes: '2050x1538',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Cashier Window',
          },
          {
            src: '/screenshots/customer.png',
            sizes: '948x1537',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Customer Display',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{css,js,html,svg,png,webp,ico,txt,woff2}'],
        navigateFallback: '/demo',
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

