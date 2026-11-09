import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { labAnimationsApi } from './vite-lab-api'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), labAnimationsApi(resolve(import.meta.dirname, '../animations'))],
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        lab: resolve(import.meta.dirname, 'lab.html'),
      },
    },
  },
})
