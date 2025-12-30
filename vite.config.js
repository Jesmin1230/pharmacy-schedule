import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Add this if you followed the v4 fix

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/pharmacy-schedule/', // <--- IMPORTANT: Use your repository name here
})