import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import markdown from 'unplugin-markdown/vite'

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          crawlLinks: true,
        },
      },
      sitemap: {
        host: 'https://gmail-notifier.rxliuli.com',
      },
      pages: [
        {
          path: '/logged',
          prerender: { enabled: true },
        },
        {
          path: '/settings',
          prerender: { enabled: true },
        },
      ],
    }),
    tailwindcss() as any,
    markdown(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
