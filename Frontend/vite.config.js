import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
  base: "/",   // ✅ ensures assets load properly on Railway
})
