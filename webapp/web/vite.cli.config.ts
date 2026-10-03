// 명령줄 가져오기(src/cli/mined.ts)를 노드에서 바로 돌릴 수 있는 한 파일(dist-cli/mined.mjs)로 묶는다.
// 의존 패키지(zip.js·saxes·ical.js·exifr·pyodide)는 묶지 않고 web/node_modules 에서 불러온다.
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'src/cli/mined.ts',
    outDir: 'dist-cli',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rolldownOptions: { output: { entryFileNames: 'mined.mjs', codeSplitting: false } },
  },
});
