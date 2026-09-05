import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { env } from 'node:process'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import vitePluginDayjs from 'vite-plugin-dayjs'

const host = env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue(), UnoCSS(), vitePluginDayjs()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('antdv-next') || id.includes('@antdv-next')) return 'antd'
            if (id.includes('vue-i18n') || id.includes('vue-router') || id.includes('\\vue\\') || id.includes('/vue/')) return 'vue-vendor'
            if (id.includes('pixi.js') || id.includes('easy-live2d')) return 'live2d'
          }
        },
      },
    },
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore Rust sources and workspace build artifacts
      ignored: ['**/src-tauri/**', '**/target/**'],
    },
  },
}))
