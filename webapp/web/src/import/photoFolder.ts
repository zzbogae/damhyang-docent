// 크롬·엣지에서 사진 폴더를 한 번 고르면 폴더 핸들을 IndexedDB 에 저장해, 새로고침 뒤에도 폴더를 다시 고르지 않고
// 권한만 다시 받아 원본을 찾게 한다(File System Access API). 사파리·파이어폭스는 지금처럼 폴더를 다시 고른다.
// 원본 사진을 복사하지 않는다. 핸들은 이 브라우저의 IndexedDB 에만 있다.
import { db } from '../db';
import type { ImportInput } from './sources';

const KEY = 'photo_dir_handle';
const PHOTO_RE = /\.(jpe?g|png|heic|heif|webp|gif|json)$/i;

interface DirLike {
  kind: 'directory';
  name: string;
  entries(): AsyncIterable<[string, DirLike | FileLike]>;
  getDirectoryHandle(name: string): Promise<DirLike>;
  getFileHandle(name: string): Promise<FileLike>;
  queryPermission?(o: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' }): Promise<PermissionState>;
}
interface FileLike { kind: 'file'; name: string; getFile(): Promise<File> }

let handle: DirLike | null = null;
let granted = false;
const loaded: Promise<void> = (async () => {
  try {
    const h = (await db.kv.get(KEY))?.value as DirLike | undefined;
    if (h) {
      handle = h;
      granted = (await h.queryPermission?.({ mode: 'read' })) === 'granted';
    }
  } catch { /* 저장된 핸들이 없거나 이 브라우저가 지원하지 않음 */ }
})();

export function canPersistFolder(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function walk(dir: DirLike, prefix: string, out: ImportInput[]) {
  for await (const [name, entry] of dir.entries()) {
    const p = `${prefix}/${name}`.normalize('NFC');
    if (entry.kind === 'directory') await walk(entry, p, out);
    else if (PHOTO_RE.test(name)) out.push({ file: await entry.getFile(), path: p });
  }
}

/** 폴더를 고르고 핸들을 저장한다. 지원하지 않으면 null(호출하는 쪽이 webkitdirectory 로 대신 고른다). */
export async function pickPhotoFolder(): Promise<ImportInput[] | null> {
  if (!canPersistFolder()) return null;
  const h = (await (window as any).showDirectoryPicker({ id: 'mined-photos', mode: 'read' })) as DirLike;
  handle = h;
  granted = true;
  try { await db.kv.put({ key: KEY, value: h }); } catch { /* 핸들 저장을 지원하지 않는 브라우저 */ }
  const out: ImportInput[] = [];
  await walk(h, h.name.normalize('NFC'), out);
  return out;
}

export async function hasPersistedPhotoFolder(): Promise<boolean> {
  await loaded;
  return !!handle;
}

/** 버튼을 누른 순간 부른다(권한 요청에는 사용자 동작이 필요). */
export async function reconnectPhotoFolder(): Promise<boolean> {
  await loaded;
  if (!handle?.requestPermission) return false;
  granted = (await handle.requestPermission({ mode: 'read' })) === 'granted';
  return granted;
}

/** NFC·NFD 가 섞인 이름(맥 파일 시스템)도 찾는다. */
async function child<T extends 'directory' | 'file'>(dir: DirLike, name: string, kind: T): Promise<T extends 'directory' ? DirLike : FileLike> {
  try {
    return (kind === 'directory' ? await dir.getDirectoryHandle(name) : await dir.getFileHandle(name)) as any;
  } catch {
    for await (const [n, e] of dir.entries()) if (e.kind === kind && n.normalize('NFC') === name.normalize('NFC')) return e as any;
    throw new Error('not found');
  }
}

/** 상대 경로(폴더이름/하위/파일)로 핸들 안의 파일을 찾는다. */
export async function resolveInFolder(root: DirLike, path: string): Promise<File | undefined> {
  const parts = path.normalize('NFC').split('/');
  if (parts.length < 2 || parts[0] !== root.name.normalize('NFC')) return undefined;
  try {
    let dir = root;
    for (const seg of parts.slice(1, -1)) dir = await child(dir, seg, 'directory');
    return await (await child(dir, parts[parts.length - 1], 'file')).getFile();
  } catch {
    return undefined;
  }
}

/** 세션 레지스트리에 없을 때 저장된 폴더 핸들에서 찾는다(권한이 이미 있을 때만). */
export async function blobFromFolder(path: string): Promise<Blob | undefined> {
  await loaded;
  if (!handle || !granted) return undefined;
  return resolveInFolder(handle, path);
}
