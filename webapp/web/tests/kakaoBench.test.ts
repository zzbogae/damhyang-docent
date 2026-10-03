// 카카오톡 대용량 처리 속도(팀 요청 4-7). BENCH=1 npx vitest run tests/kakaoBench.test.ts
// 15년치 대화방 하나를 형식별로 만들어 읽기(parseKakaoText)와 집계(aggregateKakao) 시간을 잰다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { aggregateKakao, parseKakaoText } from '../src/import/parsers/kakao';
import { Aggregator } from '../src/import/aggregate';

const N = Number(process.env.KAKAO_N ?? 600000);
const WORDS = ['오늘', '나도', '진짜', '그거', '내일', '저녁', '먹자', 'ㅋㅋㅋ', '확실히', '아니', '괜찮아', '사진', '보내줘'];

function make(format: 'pc' | 'android' | 'ios', n: number): string {
  const out: string[] = ['홍길동 님과 카카오톡 대화', '저장한 날짜 : 2026-09-01 10:15:00', ''];
  let t = Date.UTC(2011, 0, 1);
  let lastDay = '';
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) {
    t += Math.floor(rnd() * 15 * 60000);
    const d = new Date(t);
    const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, da = d.getUTCDate(), h = d.getUTCHours(), mi = d.getUTCMinutes();
    const ap = h < 12 ? '오전' : '오후', hh = h % 12 || 12, mm = String(mi).padStart(2, '0');
    const who = rnd() < 0.5 ? '나' : '홍길동';
    const text = Array.from({ length: 1 + Math.floor(rnd() * 8) }, () => WORDS[Math.floor(rnd() * WORDS.length)]).join(' ');
    const day = `${y}-${mo}-${da}`;
    if (format === 'pc') {
      if (day !== lastDay) out.push(`--------------- ${y}년 ${mo}월 ${da}일 월요일 ---------------`);
      out.push(`[${who}] [${ap} ${hh}:${mm}] ${text}`);
    } else if (format === 'android') {
      out.push(`${y}년 ${mo}월 ${da}일 ${ap} ${hh}:${mm}, ${who} : ${text}`);
    } else {
      out.push(`${y}. ${mo}. ${da}. ${ap} ${hh}:${mm}, ${who} : ${text}`);
    }
    if (rnd() < 0.05) out.push('이어지는 줄입니다');
    lastDay = day;
  }
  return out.join('\n');
}

describe.skipIf(!process.env.BENCH)('카카오톡 대용량', () => {
  const rows: string[] = [];
  for (const f of ['pc', 'android', 'ios'] as const) {
    it(`${f} ${N.toLocaleString()}개`, () => {
      const text = make(f, N);
      const t0 = performance.now();
      const chat = parseKakaoText(text, f);
      const t1 = performance.now();
      const agg = new Aggregator();
      const n = aggregateKakao([chat], '나', agg);
      agg.finalize();
      const t2 = performance.now();
      expect(chat.messages.length).toBe(N);
      expect(n).toBeGreaterThan(N * 0.4);
      rows.push(`| ${f} | ${N.toLocaleString()} | ${(text.length / 1e6).toFixed(1)}M자 | ${(t1 - t0).toFixed(0)} | ${(t2 - t1).toFixed(0)} |`);
    }, 600000);
  }
  it('기록', () => {
    fs.mkdirSync('../out', { recursive: true });
    fs.writeFileSync('../out/kakao_bench.md', ['| 형식 | 메시지 | 크기 | 읽기(ms) | 집계(ms) |', '|---|---|---|---|---|', ...rows].join('\n') + '\n');
    console.log(rows.join('\n'));
  });
});
