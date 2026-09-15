// 필터 시험 페이지 전용 설정(메인 앱 빌드와 분리). 모델은 public/models 에서 불러온다.
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: import.meta.dirname,
  publicDir: 'public',
  build: {
    outDir: 'dist-lab',
    emptyOutDir: true,
    rolldownOptions: { input: { filter: path.resolve(import.meta.dirname, 'lab/filter.html'), similar: path.resolve(import.meta.dirname, 'lab/similar.html') } },
  },
  preview: { port: 5183 },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
