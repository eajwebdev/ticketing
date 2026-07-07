import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// EAJ Ticketing — React SPA served by Laravel (single origin).
// Dev: `npm run dev` runs the Vite dev server; Laravel's @vite loads assets from it with HMR.
// Prod: `npm run build` emits hashed assets to public/build and @vite reads the manifest.
export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/main.jsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
        },
    },
    build: {
        // Split heavy vendors into separate long-cacheable chunks.
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'axios'],
                    charts: ['recharts'],
                    motion: ['framer-motion'],
                    realtime: ['laravel-echo', 'pusher-js'],
                },
            },
        },
    },
});
