import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev') },
  server: { port: 5320, strictPort: true, host: true },
  preview: { port: 5320, strictPort: true, host: true },
})
