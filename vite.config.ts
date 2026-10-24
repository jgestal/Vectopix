import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs, so the same build works at the domain root and
  // under a subpath such as GitHub Pages (/VectorApp/)
  base: './',
  plugins: [react()],
})
