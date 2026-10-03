// 사용자가 고른 파일과 zip 안 항목을 같은 모양(SourceFile)으로 다룬다.
// zip 은 zip.js BlobReader 로 필요한 부분만 잘라 읽는다(통째로 메모리에 올리지 않음).
import { BlobReader, BlobWriter, TextWriter, ZipReader, configure, type Entry, type FileEntry } from '@zip.js/zip.js';
import { nfc } from './rules';

// 가져오기는 이미 Web Worker 안에서 돌기 때문에 zip.js 가 워커를 또 띄우지 않게 한다(노드 테스트도 같음).
configure({ useWebWorkers: false });

export interface ImportInput {
  file: File;
  /** 폴더에서 고른 파일의 상대 경로(webkitRelativePath). 없으면 파일 이름 */
  path?: string;
}

export interface SourceFile {
  /** 저장·재조회에 쓰는 경로. zip 항목은 `<zip 이름>::<zip 안 경로>` */
  path: string;
  /** 판별에 쓰는 경로(zip 안 경로 또는 폴더 상대 경로, NFC) */
  inner: string;
  name: string;
  size: number;
  container?: string;
  text(): Promise<string>;
  blob(): Promise<Blob>;
  /** 내용을 스트림으로 흘려보낸다(큰 XML). */
  pipe(writable: WritableStream<Uint8Array>): Promise<void>;
}

export function inputPath(inp: ImportInput): string {
  const rel = (inp.file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return nfc(inp.path || rel || inp.file.name);
}

export function baseName(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

export function isZipName(name: string): boolean {
  return /\.zip$/i.test(name);
}

export function fileSource(inp: ImportInput): SourceFile {
  const path = inputPath(inp);
  const f = inp.file;
  return {
    path,
    inner: path,
    name: baseName(path),
    size: f.size,
    text: () => f.text(),
    blob: async () => f,
    pipe: (w) => f.stream().pipeTo(w),
  };
}

export interface OpenedZip {
  reader: ZipReader<unknown>;
  sources: SourceFile[];
  close(): Promise<void>;
}

/** zip 파일의 항목 목록(중앙 디렉터리만 읽음) */
export async function openZip(inp: ImportInput): Promise<OpenedZip> {
  const zipName = baseName(inputPath(inp));
  const reader = new ZipReader(new BlobReader(inp.file));
  const entries = await reader.getEntries();
  const sources: SourceFile[] = [];
  for (const e of entries as Entry[]) {
    if (e.directory) continue;
    const fe = e as FileEntry;
    const inner = nfc(fe.filename);
    sources.push({
      path: `${zipName}::${inner}`,
      inner,
      name: baseName(inner),
      size: fe.uncompressedSize,
      container: zipName,
      text: () => fe.getData(new TextWriter()),
      blob: () => fe.getData(new BlobWriter()),
      pipe: async (w) => { await fe.getData(w); },
    });
  }
  return { reader, sources, close: () => reader.close() };
}
