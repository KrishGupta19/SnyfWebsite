import { defineConfig } from 'vite';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '');
        return path.resolve(__dirname, 'src/assets', filename);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
    VitePWA({
      // Auto-update SW on new deploy — no manual user action needed
      registerType: 'autoUpdate',

      // SW generated in the outDir (../cafe-os)
      outDir: '../cafe-os',

      // Include manifest and icons in build
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],

      manifest: false, // We use our own manifest.webmanifest in public/

      workbox: {
        // Cache app shell and static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        globDirectory: '../cafe-os',

        // Never cache Supabase API calls or Netlify functions
        navigateFallback: '/cafe-os/index.html',
        navigateFallbackDenylist: [
          /^\/supabase-api\//,
          /^\/get-or-create-user/,
          /^\/\.netlify\//,
          /^\/functions\//,
        ],

        runtimeCaching: [
          {
            // Cache Supabase storage images (venue photos, menu items)
            urlPattern: /^https:\/\/pjygywbgwujkvpexmxuu\.supabase\.co\/storage\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'snyf-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'snyf-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],

        // Skip waiting — update immediately on new deployment
        skipWaiting: true,
        clientsClaim: true,
      },

      // Dev options — disable SW in dev to avoid caching issues
      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],

  base:  '/cafe-os/',
  build: {
    outDir:     '../cafe-os',
    emptyOutDir: false,
  },
});
