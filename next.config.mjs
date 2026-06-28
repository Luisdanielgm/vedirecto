import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // imagen Docker chica (estilo Dokploy)
  // Hay varios lockfiles en árboles superiores (OneDrive); fijamos la raíz
  // de tracing a este proyecto para que el standalone quede en .next/standalone.
  outputFileTracingRoot: __dirname,
}

export default nextConfig
