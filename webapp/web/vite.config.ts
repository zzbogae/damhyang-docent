import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { mindiRelay } from './src/mindi/relay-plugin.ts';
import { lifebotRelay } from './src/mindi/lifebot-plugin.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, '..'), '');
  // 나의 공간 이미지 생성(/api/space/*)은 파이썬 서버(hf-space/server.py)가 맡는다. 개발 중에는 로컬로 띄운 그 서버로 넘긴다.
  // 예: hf-space 에서 `uvicorn server:app --port 8791` 뒤 SPACE_API_URL=http://127.0.0.1:8791 npm run dev
  const spaceApi = env.SPACE_API_URL || process.env.SPACE_API_URL;
  const spaceProxy = spaceApi ? { '/api/space': { target: spaceApi, changeOrigin: true } } : undefined;
  return {
    plugins: [
      react(),
      mindiRelay(env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY),
      lifebotRelay(env.LIFEBOT_URL || process.env.LIFEBOT_URL, env.LIFEBOT_AUTH || process.env.LIFEBOT_AUTH),
    ],
    server: { port: 5181, proxy: spaceProxy, fs: { allow: [path.resolve(import.meta.dirname, '..')] } },
    preview: { port: 5182, proxy: spaceProxy },
    worker: { format: 'es' },
    define: { __BUILD_ID__: JSON.stringify(String(Date.now())) },
    optimizeDeps: { exclude: ['pyodide', 'onnxruntime-web'] },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
      testTimeout: 120000,
    },
  };
});
