import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",   // default, but explicit
  },
  server: {
    port: 5173,       // local dev port
    open: true,
  },
  base: "/",          // 👈 ensures assets resolve correctly on Railway
})
