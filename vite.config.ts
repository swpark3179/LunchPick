import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri 개발 서버는 고정 포트가 필요하다 (tauri.conf.json devUrl 과 일치).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'chrome120', // WebView2 Evergreen
    sourcemap: false,
  },
});
