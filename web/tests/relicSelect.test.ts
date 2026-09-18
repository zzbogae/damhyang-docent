// 되돌려줄 원문 고르기 단위 테스트. 메모 문장은 모두 지어낸 것이다.
import { describe, it, expect } from 'vitest';
import { selectRelic, jaccard3 } from '../src/relic/select';
import type { MemoRecord, PhotoRecord, WeekRecord, Badge } from '../src/types';

function week(badges: Partial<Badge>[] = []): WeekRecord {
  return {
    schema: 'mined.week/7', week: '2017-W07', date_start: '2017-02-13', date_end: '2017-02-19', candidate: true,
    coverage: { health: 'observed', memo: 'observed', photo: 'observed', yt: 'observed', cal: 'observed', kakao: 'observed', sns: 'structural_missing', ai: 'structural_missing' },
    ind: {}, axes: { steps: null, sleep: null, screen: null, record: null },
    badges: badges.map((b) => ({ indicator: 'memo_night', label: '', family: 'memo', axis: 'record', direction: 'up', pr: 0.98, rank: 1, n_base: 52, extreme: 2, ...b }) as Badge),
    evidence: { families: ['memo'], independent: 1, cross_validated: false },
    tier: 'observed', tier_history: [], access: 'auto', era: null, mineral: null, shape: null, similar: [], sentence: null,
  };
}

let seq = 0;
function memo(date: string, hour: number, text: string, extra: Partial<MemoRecord> = {}): MemoRecord {
  const id = `m${++seq}`;
  return { id, ts: `${date}T${String(hour).padStart(2, '0')}:10`, date, week: '2017-W07', hour, text, chars: text.length, source: 'keep', ...extra };
}
function photo(date: string, hour: number, status?: 'ok' | 'hidden' | 'error', reasons: any[] = []): PhotoRecord {
  const id = `p${++seq}`;
  return {
    id, date, week: '2017-W07', hour, name: `${id}.jpg`, path: `${id}.jpg`, size: 1, mime: 'image/jpeg', source: 'folder', hasExif: true,
    ...(status ? { filter: { status, reasons, checkedAt: '2026-09-11T00:00:00Z' } } : {}),
  };
}

describe('메모 고르기', () => {
  it('자격증명 메모는 절대 고르지 않고 숨긴 수에 센다', () => {
    const ms = [memo('2017-02-14', 10, '현관 비번은 4812'), memo('2017-02-15', 11, '화분을 돌려줘야 한다는데 매번 잊는다')];
    const r = selectRelic(week(), ms, []);
    expect(r.memo_ids).toEqual([ms[1].id]);
    expect(r.hidden.secret).toBe(1);
  });

  it('필터 표시가 이미 있어도 secret 이면 뺀다', () => {
    const m = memo('2017-02-14', 10, '평범한 문장처럼 보이지만 표시가 있음', { flags: { secret: true, secretKinds: ['phone'] } });
    const r = selectRelic(week(), [m], []);
    expect(r.memo_ids).toEqual([]);
    expect(r.hidden.secret).toBe(1);
  });

  it('위기 표현 메모는 고르되 확인 후 열람으로 표시한다', () => {
    const ms = [memo('2017-02-14', 2, '요즘은 그냥 사라지고 싶다는 생각이 든다'), memo('2017-02-16', 14, '달리기 이십 분')];
    const r = selectRelic(week(), ms, []);
    expect(r.memo_ids).toContain(ms[0].id);
    expect(r.gated_memo_ids).toEqual([ms[0].id]);
    expect(r.hidden.crisis).toBe(1);
  });

  it('새벽 메모 배지가 있으면 새벽에 쓴 메모를 먼저 고른다', () => {
    const day = [memo('2017-02-14', 13, '점심 메뉴 고민 중 김밥이냐 국수냐'), memo('2017-02-15', 15, '서점에서 산 책 목록 정리'), memo('2017-02-16', 16, '우산을 두고 왔다 비는 안 왔다')];
    const night = [memo('2017-02-14', 3, '새벽 세시 냉장고 소리만 크게 들린다'), memo('2017-02-17', 1, '잠이 안 와서 창밖을 봤다')];
    const r = selectRelic(week([{ indicator: 'memo_night', direction: 'up' }]), [...day, ...night], [], { maxMemos: 2 });
    expect(new Set(r.memo_ids)).toEqual(new Set(night.map((m) => m.id)));
  });

  it('메모 길이 배지(위쪽)면 긴 메모를 먼저 고른다', () => {
    const short = memo('2017-02-14', 10, '짧다');
    const long = memo('2017-02-15', 10, '길게 쓴 메모 '.repeat(20));
    const r = selectRelic(week([{ indicator: 'memo_len', direction: 'up' }]), [short, long], [], { maxMemos: 1 });
    expect(r.memo_ids).toEqual([long.id]);
  });

  it('거의 같은 글은 하나만 남긴다(3-gram 자카드 0.6 이상)', () => {
    const a = memo('2017-02-14', 9, '습작. 그는 문을 닫지 않고 나갔다 그게 대답이었다');
    const b = memo('2017-02-15', 21, '습작. 그는 문을 닫지 않고 나갔다. 그게 대답이었다');
    const c = memo('2017-02-16', 12, '국수 삶는 물에 소금 넣는 걸 또 잊었다');
    expect(jaccard3(a.text, b.text)).toBeGreaterThanOrEqual(0.6);
    const r = selectRelic(week(), [a, b, c], []);
    expect(r.memo_ids.length).toBe(2);
    expect(r.memo_ids).toContain(c.id);
  });

  it('같은 시각에 쓴 메모가 몰려 있으면 다른 날·시각을 먼저 고르고 최대 5개', () => {
    const lines = ['고양이는 창밖을 볼 때 목만 돌린다', '국수 삶는 물에 소금을 또 잊었다', '라디오에서 우표 얘기를 들었다',
      '체리 씨를 세어 봤더니 열두 개', '지도 앱이 처음 보는 골목으로 안내했다', '낮잠을 자면 저녁이 두 번 오는 것 같다'];
    const burst = lines.map((t) => memo('2017-02-14', 23, t));
    const other = [memo('2017-02-15', 8, '아침 산책길 자전거가 없어졌다'), memo('2017-02-18', 19, '새 노트 첫 장을 잘 못 쓴다')];
    const r = selectRelic(week(), [...burst, ...other], []);
    expect(r.memo_ids.length).toBe(5);
    expect(r.memo_ids).toEqual(expect.arrayContaining(other.map((m) => m.id)));
  });

  it('다른 주의 메모는 섞이지 않는다', () => {
    const out = { ...memo('2017-02-21', 10, '다음 주 메모'), week: '2017-W08' };
    const r = selectRelic(week(), [out], []);
    expect(r.memo_ids).toEqual([]);
  });
});

describe('사진 고르기', () => {
  it('필터 결과가 ok 인 사진만 고르고 숨긴 이유별로 센다', () => {
    const ps = [photo('2017-02-14', 12, 'ok'), photo('2017-02-14', 13, 'hidden', ['face']), photo('2017-02-15', 9, 'hidden', ['text', 'face']),
      photo('2017-02-15', 10, 'hidden', ['screenshot']), photo('2017-02-16', 11, 'error', ['decode']), photo('2017-02-16', 12)];
    const r = selectRelic(week(), [], ps);
    expect(r.photo_ids).toEqual([ps[0].id]);
    expect(r.hidden).toMatchObject({ face: 2, text: 1, screenshot: 1 });
    expect(r.error_photos).toBe(1);
    expect(r.pending_photo_ids).toEqual([ps[5].id]);
  });

  it('새벽 촬영 배지면 새벽 사진을 먼저, 최대 12장', () => {
    const day = Array.from({ length: 14 }, (_, i) => photo(`2017-02-${String(13 + (i % 7)).padStart(2, '0')}`, 10 + (i % 8), 'ok'));
    const night = [photo('2017-02-14', 2, 'ok'), photo('2017-02-16', 3, 'ok')];
    const r = selectRelic(week([{ indicator: 'photo_night', family: 'photo', direction: 'up' }]), [], [...day, ...night]);
    expect(r.photo_ids.length).toBe(12);
    expect(r.photo_ids.slice(0, 2).sort()).toEqual(night.map((p) => p.id).sort());
  });
});
