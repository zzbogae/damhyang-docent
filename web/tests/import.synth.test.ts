// 합성 인물 3명의 원천 파일을 파서로 읽은 결과가 생성기의 정답 표와 같은지 본다.
import { beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../src/import/importer';
import type { DailyRow } from '../src/types';
import { ensureSynth, exportInputs, readJson } from './helpers/synth';

function diffDaily(got: DailyRow[], want: DailyRow[]): string[] {
  const g = new Map(got.map((r) => [r.date, r as unknown as Record<string, unknown>]));
  const w = new Map(want.map((r) => [r.date, r as unknown as Record<string, unknown>]));
  const out: string[] = [];
  for (const date of new Set([...g.keys(), ...w.keys()])) {
    const a = g.get(date) ?? {};
    const b = w.get(date) ?? {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (k === 'date') continue;
      const va = a[k] as number | undefined;
      const vb = b[k] as number | undefined;
      if (k === 'sleep_min' && va != null && vb != null && Math.abs(va - vb) <= 1) continue;
      if (va !== vb) out.push(`${date} ${k}: got ${va} want ${vb}`);
    }
  }
  return out.sort();
}

for (const persona of ['short', 'elder', 'long']) {
  describe(`합성 인물 ${persona}`, () => {
    let result: Awaited<ReturnType<typeof runImport>>;
    beforeAll(async () => {
      ensureSynth(persona);
      result = await runImport(exportInputs(persona));
    }, 240000);

    it('일 단위 표가 정답과 같다', () => {
      const want = readJson<DailyRow[]>(persona, 'truth_daily.json');
      const diffs = diffDaily(result.daily, want);
      expect(diffs.slice(0, 20)).toEqual([]);
      expect(result.daily.length).toBe(want.length);
      // 비교가 빈 표끼리가 아님을 확인: 정답에 있는 필드가 결과에도 모두 나온다
      const fields = (rs: DailyRow[]) => [...new Set(rs.flatMap((r) => Object.keys(r)))].sort();
      expect(fields(result.daily)).toEqual(fields(want));
      expect(want.length).toBeGreaterThan(500);
    });

    it('채널 메타와 내보낸 날짜가 정답과 같다', () => {
      const want = readJson(persona, 'truth_meta.json');
      expect(result.meta.export_date).toBe(want.export_date);
      expect(result.meta.channels).toEqual(want.channels);
    });

    it('메모 원문 레코드가 정답과 같다', () => {
      const want = readJson<any[]>(persona, 'memos.json');
      const got = result.memos.map((m) => ({ id: m.id, ts: m.ts, chars: m.chars, text: m.text }));
      const exp = want.map((m) => ({ id: m.id, ts: m.ts, chars: m.chars, text: m.text }));
      const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
      expect(got.sort(byId)).toEqual(exp.sort(byId));
    });

    it('사진 색인이 정답과 같다(화면 캡처 포함, 날짜 없는 사진 제외)', () => {
      const want = readJson<any[]>(persona, 'photos.json');
      const got = result.photos.map((p) => `${p.path}|${p.date}|${p.hour}`).sort();
      const exp = want.map((p) => `${p.path}|${p.date}|${p.hour}`).sort();
      expect(got).toEqual(exp);
      expect(result.warnings.some((w) => w.includes('건너뛴 사진 5장'))).toBe(true);
    });

    it('카카오톡 "나"를 인물 이름으로 고른다', () => {
      const ev = readJson(persona, 'events.json');
      expect(result.kakaoMe).toBe(ev.kakao_me);
    });
  });
}
