import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { setPhotoService } from './photos/service';
import { createPhotoService } from './photos/impl';

// 사진 원본은 가져오기 모듈의 세션 레지스트리에서 찾는다(연결 전에는 찾지 못함 → 닫힌 쪽 실패).
setPhotoService(createPhotoService(async (path) => {
  try {
    const mod: any = await import('./importBridge');
    return mod.getPhotoBlob ? await mod.getPhotoBlob(path) : undefined;
  } catch { return undefined; }
}));

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// 오프라인 캐시(배포 빌드에서만). 한 번 연 뒤에는 인터넷 없이도 열린다.
declare const __BUILD_ID__: string;
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${__BUILD_ID__}`).catch(() => undefined);
}
