import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

/**
 * Custom Vite plugin to inject build hash into service worker
 * This ensures consistent cache versioning based on actual content changes
 */
function serviceWorkerBuildHash(): Plugin {
  let buildHash = '';

  return {
    name: 'sw-build-hash',
    apply: 'build',

    // Generate hash from all built assets
    generateBundle(_, bundle) {
      // Create hash from all chunk content
      const hash = crypto.createHash('sha256');
      const sortedKeys = Object.keys(bundle).sort();

      for (const key of sortedKeys) {
        const chunk = bundle[key];
        if (chunk.type === 'chunk' && chunk.code) {
          hash.update(chunk.code);
        } else if (chunk.type === 'asset' && typeof chunk.source === 'string') {
          hash.update(chunk.source);
        }
      }

      // Use first 12 characters of hash for readability
      buildHash = hash.digest('hex').slice(0, 12);
    },

    // Process service worker after build
    closeBundle() {
      const swPath = path.resolve(import.meta.dirname, 'dist/public/sw.js');

      // Wait a moment for files to be written
      setTimeout(() => {
        try {
          if (fs.existsSync(swPath)) {
            let swContent = fs.readFileSync(swPath, 'utf-8');

            // Replace placeholder with actual build hash
            swContent = swContent.replace(/__BUILD_HASH__/g, buildHash);

            fs.writeFileSync(swPath, swContent);
            console.log(`[sw-build-hash] Injected build hash: ${buildHash}`);
          } else {
            console.warn('[sw-build-hash] Service worker not found at', swPath);
          }
        } catch (error) {
          console.error('[sw-build-hash] Failed to inject build hash:', error);
        }
      }, 100);
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    // Inject content-based hash into service worker for consistent cache versioning
    serviceWorkerBuildHash(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React vendor chunk
          'vendor-react': ['react', 'react-dom'],
          // UI component libraries
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-checkbox',
          ],
          // Form handling
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // State management
          'vendor-query': ['@tanstack/react-query'],
          // Animation library (4MB - isolated)
          'vendor-animation': ['framer-motion'],
          // Audio encoding (6.6MB - isolated, lazy loaded)
          'vendor-audio': ['lamejs'],
          // Drag and drop
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'wouter'],
    exclude: ['lamejs'], // Lazy loaded
  },
});
