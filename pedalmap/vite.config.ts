/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath, URL } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))
const MAPLIBRE_WORKER_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'] as const

function copyMapLibreWorkers(targetDir: string) {
  mkdirSync(targetDir, { recursive: true })
  for (const file of MAPLIBRE_WORKER_FILES) {
    const from = resolve(rootDir, 'node_modules/maplibre-gl/dist', file)
    if (!existsSync(from)) {
      throw new Error(`Missing MapLibre worker asset: ${from}`)
    }
    copyFileSync(from, resolve(targetDir, file))
  }
}

function serveMapLibreWorker(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const path = req.url?.split('?')[0] ?? ''
  const file = MAPLIBRE_WORKER_FILES.find((name) => path.endsWith(`/assets/${name}`))
  if (!file) {
    next()
    return
  }

  const built = resolve(rootDir, 'dist/assets', file)
  const source = existsSync(built)
    ? built
    : resolve(rootDir, 'node_modules/maplibre-gl/dist', file)

  res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  createReadStream(source).pipe(res)
}

/**
 * MapLibre 6 loads `maplibre-gl-worker.mjs` next to the app chunk. Vite does not
 * emit those files, so preview falls back to index.html and the map stays blank.
 */
function maplibreWorkersPlugin(): Plugin {
  const assetsDir = resolve(rootDir, 'dist/assets')

  return {
    name: 'maplibre-workers',
    configureServer(server) {
      server.middlewares.use(serveMapLibreWorker)
    },
    configurePreviewServer(server) {
      copyMapLibreWorkers(assetsDir)
      server.middlewares.use(serveMapLibreWorker)
    },
    closeBundle() {
      copyMapLibreWorkers(assetsDir)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreWorkersPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Allow Cloudflare quick tunnels / localtunnel hosts for public previews.
  preview: {
    host: true,
    allowedHosts: true,
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
})
