import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: {
    react: ['react', 'react-dom'],
    'firebase-auth': ['firebase/app', 'firebase/auth'],
    'firebase-store': ['firebase/firestore']
  } } } }
})
