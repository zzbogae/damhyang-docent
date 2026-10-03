// 세션 동안 사진 경로 → 바이트를 다시 찾는 레지스트리. 사진 원본은 저장소에 넣지 않는다.
// 화면(메인 스레드)에서 사용자가 파일을 고를 때 registerInputs 를 부르고, 사진 필터는 getPhotoBlob 으로 바이트를 얻는다.
// 새로고침하면 비워진다. 크롬·엣지에서 폴더 핸들을 저장해 두었으면 photoFolder.ts 가 권한만 다시 받아 원본을 찾는다.
import { BlobReader, BlobWriter, ZipReader, configure, type FileEntry } from '@zip.js/zip.js';
import { mimeOf } from './parsers/photos';
import { baseName, type ImportInput, inputPath, isZipName } from './sources';
import { blobFromFolder } from './photoFolder';

configure({ useWebWorkers: false });

const files = new Map<string, File>();
const zips = new Map<string, { file: File; entries?: Promise<Map<string, FileEntry>> }>();

export function registerInputs(inputs: ImportInput[]) {
  for (const inp of inputs) {
    const p = inputPath(inp);
    if (isZipName(p)) zips.set(baseName(p), { file: inp.file });
    else files.set(p, inp.file);
  }
}

export function clearRegistry() {
  files.clear();
  zips.clear();
}

export function hasPhotoSource(path: string): boolean {
  if (files.has(path)) return true;
  const i = path.indexOf('::');
  return i > 0 && zips.has(path.slice(0, i));
}

async function zipEntries(name: string): Promise<Map<string, FileEntry> | undefined> {
  const z = zips.get(name);
  if (!z) return undefined;
  if (!z.entries) {
    z.entries = (async () => {
      const reader = new ZipReader(new BlobReader(z.file));
      const m = new Map<string, FileEntry>();
      for (const e of await reader.getEntries()) if (!e.directory) m.set(e.filename.normalize('NFC'), e as FileEntry);
      return m;
    })();
  }
  return z.entries;
}

/** 사진 경로(PhotoRecord.path)로 원본 바이트를 얻는다. 세션에 없으면 undefined */
export async function getPhotoBlob(path: string): Promise<Blob | undefined> {
  const f = files.get(path);
  if (f) return f;
  const i = path.indexOf('::');
  if (i <= 0) return blobFromFolder(path);
  const entries = await zipEntries(path.slice(0, i));
  const e = entries?.get(path.slice(i + 2));
  if (!e) return undefined;
  return e.getData(new BlobWriter(mimeOf(path)));
}
