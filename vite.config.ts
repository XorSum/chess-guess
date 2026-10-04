import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  root: 'web', // 网页版应用目录：web/index.html + web/src + web/public（开局树 json 由此提供静态服务）
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [react()],
})
