// 브라우저에서 쓰는 런타임·모델 파일을 web/public 아래로 모은다(저장소에는 넣지 않음).
// 실행: cd web && npm run assets
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, '../web');
const pub = path.join(web, 'public');

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  console.log('downloaded', path.relative(web, dest), fs.statSync(dest).size);
}

function copyDir(src, dest, filter = () => true) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f);
    if (fs.statSync(s).isFile() && filter(f)) fs.copyFileSync(s, path.join(dest, f));
  }
}

// 1) Pyodide 런타임 + numpy 휠 (오프라인 시연을 위해 CDN 대신 로컬에서 불러온다)
const pyNode = path.join(web, 'node_modules/pyodide');
const pyDest = path.join(pub, 'pyodide');
copyDir(pyNode, pyDest, (f) => /\.(js|mjs|wasm|zip|json)$/.test(f) && !f.endsWith('.d.ts'));
const lock = JSON.parse(fs.readFileSync(path.join(pyNode, 'pyodide-lock.json'), 'utf8'));
const pyVersion = JSON.parse(fs.readFileSync(path.join(pyNode, 'package.json'), 'utf8')).version;
const cdn = `https://cdn.jsdelivr.net/pyodide/v${pyVersion}/full/`;
for (const name of ['numpy']) {
  const pkg = lock.packages[name];
  await download(cdn + pkg.file_name, path.join(pyDest, pkg.file_name));
}

// 2) 사진 필터 모델과 런타임 (기기 안에서만 실행)
const models = path.join(pub, 'models');
// MediaPipe BlazeFace: 가까운 거리용(230KB)과 먼 거리용(1.1MB). Apache-2.0
await download(
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
  path.join(models, 'blaze_face_short_range.tflite'),
);
await download(
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/latest/blaze_face_full_range.tflite',
  path.join(models, 'blaze_face_full_range.tflite'),
);
copyDir(path.join(web, 'node_modules/@mediapipe/tasks-vision/wasm'), path.join(models, 'mediapipe-wasm'));
// PP-OCRv5 mobile det(글자 영역 검출, 4.8MB). Apache-2.0
await download(
  'https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det_onnx/resolve/main/inference.onnx',
  path.join(models, 'ppocrv5_mobile_det.onnx'),
);
// PP-OCRv5 korean mobile rec(한국어 글자 인식, 13MB). Apache-2.0. 스크린타임 캡처에서 사용 시간을 읽는다(기기 안)
await download(
  'https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.onnx',
  path.join(models, 'korean_ppocrv5_mobile_rec.onnx'),
);
const recYml = path.join(models, 'korean_ppocrv5_mobile_rec.yml');
await download('https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec_onnx/resolve/main/inference.yml', recYml);
// 인식 결과 번호 → 글자 사전(yml 의 PostProcess.character_dict)을 JSON 배열로
{
  const lines = fs.readFileSync(recYml, 'utf8').split('\n');
  const i = lines.findIndex((l) => l.trim() === 'character_dict:');
  const dict = [];
  for (const l of lines.slice(i + 1)) {
    if (!l.startsWith('  - ')) break;
    let v = l.slice(4);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replaceAll("''", "'");
    else if (v.startsWith('"') && v.endsWith('"')) v = JSON.parse(v);
    dict.push(v);
  }
  fs.writeFileSync(path.join(models, 'korean_ppocrv5_dict.json'), JSON.stringify(dict));
  console.log('dict', dict.length);
}
// onnxruntime-web 의 wasm 런타임(스레드 없는 기본판만 써도 됨)
copyDir(path.join(web, 'node_modules/onnxruntime-web/dist'), path.join(models, 'ort'), (f) =>
  /^ort-wasm-simd-threaded(\.jsep)?\.(mjs|wasm)$/.test(f),
);

console.log('assets ready');
