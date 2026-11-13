import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5190,
    strictPort: true, // 5173 은 다른 프로젝트가 쓰고 있어 고정 포트를 따로 둔다
    // /api 요청을 FastAPI(8010)로 넘긴다. 인증키는 백엔드에만 있고 브라우저에 노출되지 않는다.
    proxy: { '/api': process.env.VITE_API_TARGET || 'http://127.0.0.1:8010' },
  },
})
