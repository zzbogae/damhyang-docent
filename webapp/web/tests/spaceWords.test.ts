// 나의 공간 이미지 생성 단어 필터. 예시는 모두 지어낸 값이다(서버 테스트와 같은 예시 파일을 쓴다).
import { describe, it, expect } from 'vitest';
import { filterWords, matchWord, KEYWORDS, MAX_WORDS } from '../src/space/wordFilter';
import cases from '../src/space/wordFilter.cases.json';

describe('섬 키워드 사전', () => {
  it('승인(active) 단어 124개만 들어 있다', () => {
    expect(KEYWORDS.length).toBe(124);
    expect(new Set(KEYWORDS.map((k) => k.id)).size).toBe(124);
  });
});

describe('matchWord', () => {
  it.each(cases.match as [string, string][])('%s → %s', (raw, word) => {
    expect(matchWord(raw)?.word).toBe(word);
  });
  it.each(cases.drop)('「%s」는 버린다(이름·장소·감정어·청소년 제외·승인 전·너무 긴 말)', (raw) => {
    expect(matchWord(raw)).toBeNull();
  });
});

describe('filterWords', () => {
  it('사전 단어만 대표어로, 중복 없이, 최대 다섯 개', () => {
    const r = filterWords(cases.list.in);
    expect(r.kept.map((k) => k.word)).toEqual(cases.list.kept);
    expect(r.kept.length).toBeLessThanOrEqual(MAX_WORDS);
    expect(r.dropped).toBe(2);
  });
  it('남은 단어에 버린 말이 섞이지 않는다', () => {
    const out = JSON.stringify(filterWords(['김민준이랑 바다', '서울역']).kept);
    expect(out).not.toContain('김민준');
    expect(out).not.toContain('서울역');
  });
});
