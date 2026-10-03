import { describe, expect, it } from 'vitest';
import { dateFromName, parseDuration, readScreenTime } from '../src/import/screentime';

const L = (text: string, y: number) => ({ text, x: 0.1, y, w: 0.5, h: 0.03, score: 0.9 });

describe('스크린타임 캡처 해석', () => {
  it('시간 표기를 분으로 바꾼다', () => {
    expect(parseDuration('4시간 23분')).toBe(263);
    expect(parseDuration('4시간23분')).toBe(263);
    expect(parseDuration('2시간')).toBe(120);
    expect(parseDuration('47분')).toBe(47);
    expect(parseDuration('5h 12m')).toBe(312);
    expect(parseDuration('지난주 대비 12% 감소')).toBe(null);
  });
  it('일일 평균 아래의 값을 주 평균으로 읽고, 앱별 줄은 쓰지 않는다', () => {
    const r = readScreenTime([L('스크린 타임', 0.05), L('일일 평균', 0.12), L('4시간 23분', 0.16), L('YouTube', 0.6), L('1시간 50분', 0.6)]);
    expect(r).toMatchObject({ minutes: 263, kind: 'week_avg' });
  });
  it('오늘·어제 값은 그날 값으로 읽는다', () => {
    expect(readScreenTime([L('오늘', 0.1), L('2시간 5분', 0.14)])).toMatchObject({ minutes: 125, kind: 'day', offsetDays: 0 });
    expect(readScreenTime([L('어제', 0.1), L('3시간 12분', 0.14)])).toMatchObject({ minutes: 192, kind: 'day', offsetDays: -1 });
  });
  it('파일 이름에서 날짜를 읽는다', () => {
    expect(dateFromName('Screenshot_20250304-221233.png')).toBe('2025-03-04');
    expect(dateFromName('스크린샷 2025-03-04 오후 10.12.33.png')).toBe('2025-03-04');
    expect(dateFromName('IMG_4821.PNG')).toBe(null);
  });
});
