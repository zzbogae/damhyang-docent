// 저장된 폴더 핸들에서 상대 경로로 사진을 찾는다(맥의 NFD 이름 포함). File System Access API 흉내 객체로 시험.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { resolveInFolder } from '../src/import/photoFolder';

function dir(name: string, children: Record<string, any>): any {
  return {
    kind: 'directory', name,
    async *entries() { for (const [k, v] of Object.entries(children)) yield [k, v]; },
    async getDirectoryHandle(n: string) { const c = children[n]; if (c?.kind !== 'directory') throw new Error('nf'); return c; },
    async getFileHandle(n: string) { const c = children[n]; if (c?.kind !== 'file') throw new Error('nf'); return c; },
  };
}
const file = (name: string) => ({ kind: 'file', name, getFile: async () => new File([name], name) });

describe('사진 폴더 핸들', () => {
  const nfd = '여름'.normalize('NFD');
  const root = dir('사진', { '2024': dir('2024', { [nfd]: dir(nfd, { 'a.jpg': file('a.jpg') }) }), 'b.jpg': file('b.jpg') });
  it('상대 경로로 찾는다', async () => {
    expect((await resolveInFolder(root, '사진/b.jpg'))?.name).toBe('b.jpg');
    expect((await resolveInFolder(root, '사진/2024/여름/a.jpg'))?.name).toBe('a.jpg');
  });
  it('다른 폴더 경로나 없는 파일은 undefined', async () => {
    expect(await resolveInFolder(root, '다른폴더/b.jpg')).toBeUndefined();
    expect(await resolveInFolder(root, '사진/없음.jpg')).toBeUndefined();
  });
});
