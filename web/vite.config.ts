import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { mindiRelay } from './src/mindi/relay-plugin.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, '..'), '');
  return {
    plugins: [react(), mindiRelay(env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY)],
    server: { port: 5181, fs: { allow: [path.resolve(import.meta.dirname, '..')] } },
    preview: { port: 5182 },
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
