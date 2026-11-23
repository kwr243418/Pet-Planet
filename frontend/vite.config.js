import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 백엔드(Spring 등) 로컬 서버로 /api 요청을 프록시합니다.
// VITE_USE_MOCK=true 이면 프록시를 거치지 않고 src/mocks 의 목 서버가 응답합니다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
