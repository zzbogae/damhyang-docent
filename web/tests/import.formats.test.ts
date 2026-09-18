// 형식별 단위 시험: 카카오톡 3형식, 유튜브 한국어·영어, 캘린더 반복, 애플 건강 스트리밍, 경로 판별.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Aggregator } from '../src/import/aggregate';
import { isoWeek } from '../src/import/dates';
import { parseCalendar } from '../src/import/parsers/calendar';
import { HealthAcc, parseAppleHealth, sleepSessions, splitCsvLine } from '../src/import/parsers/health';
import { aggregateKakao, parseKakaoText, participants } from '../src/import/parsers/kakao';
import { nameDate } from '../src/import/parsers/photos';
import { parseYouTube } from '../src/import/parsers/youtube';
import { classify, looksLikeKakao } from '../src/import/router';
import { isAssertive, isFirstPerson } from '../src/import/rules';
import { openZip } from '../src/import/sources';
import { runImport } from '../src/import/importer';
import { ensureSynth, exportInputs, SYNTH_OUT } from './helpers/synth';

const rows = (agg: Aggregator) => Object.fromEntries(agg.finalize().daily.map((r) => [r.date, r]));

describe('카카오톡', () => {
  const pc = [
    '김서연 님과 카카오톡 대화',
    '저장한 날짜 : 2026-09-01 10:15:00',
    '',
    '--------------- 2023년 1월 1일 일요일 ---------------',
    '[김서연] [오후 11:58] 자?',
    '--------------- 2023년 1월 2일 월요일 ---------------',
    '[한도윤] [오전 12:03] 나는 아직 안 자',
    '둘째 줄',
    '[한도윤] [오전 12:10] 무조건 내일 가자',
    '[김서연] [오후 12:00] 점심',
    '[한도윤] [오후 6:30] 제가 늦었네요',
  ].join('\n');
  const android = [
    '팀 채팅 님과 카카오톡 대화',
    '저장한 날짜 : 2026년 9월 1일 오전 10:15',
    '',
    '2023년 1월 1일 일요일',
    '2023년 1월 1일 오후 3:04, 강민서 : 안녕',
    '2023년 1월 1일 오후 3:05, 강민서님이 들어왔습니다.',
    '2023년 1월 1일 오후 3:10, 서지안 : 저도 지금 봤어요',
  ].join('\n');
  const ios = [
    '큰딸 님과 카카오톡 대화',
    '저장한 날짜 : 2026. 8. 31. 오후 8:02',
    '',
    '2023년 1월 1일 일요일',
    '2023. 1. 1. 오전 9:00, 큰딸 : 엄마 뭐해',
    '2023. 1. 1. 오전 11:30, 문영자 : 절대 걱정 마',
  ].join('\n');

  it('PC 형식: 날짜 줄·이어지는 줄·오전 12시', () => {
    const c = parseKakaoText(pc, 'a.txt');
    expect(c.format).toBe('pc');
    expect(c.savedDate).toBe('2026-09-01');
    expect(c.messages.map((m) => [m.sender, m.t.date, m.t.hour, m.t.minute])).toEqual([
      ['김서연', '2023-01-01', 23, 58], ['한도윤', '2023-01-02', 0, 3], ['한도윤', '2023-01-02', 0, 10],
      ['김서연', '2023-01-02', 12, 0], ['한도윤', '2023-01-02', 18, 30],
    ]);
    expect(c.messages[1].text).toBe('나는 아직 안 자\n둘째 줄');
  });

  it('PC 형식 집계: 새벽·1인칭·단정어·답장 지연(자정 넘김)', () => {
    const agg = new Aggregator();
    const c = parseKakaoText(pc, 'a.txt');
    aggregateKakao([c], '한도윤', agg);
    const r = rows(agg);
    // 1/1 23:58 → 1/2 00:03 답장 5분(자정 넘김). 00:10 은 내 메시지 뒤라 답장 아님. 18:30 은 12:00 뒤 390분 → 360.
    // 글자 수: "나는 아직 안 자\n둘째 줄"(14) + "무조건 내일 가자"(9) + "제가 늦었네요"(7) = 30
    expect(r['2023-01-01']).toBeUndefined();
    expect(r['2023-01-02']).toMatchObject({ kakao_n: 3, kakao_night_n: 2, kakao_assert_n: 1, kakao_first_n: 2, kakao_reply_n: 2, kakao_reply_min_sum: 365, kakao_chars: 30 });
  });

  it('안드로이드 형식: 시스템 줄은 무시', () => {
    const c = parseKakaoText(android, 'b.txt');
    expect(c.format).toBe('android');
    expect(c.savedDate).toBe('2026-09-01');
    expect(c.messages.map((m) => [m.sender, m.t.hour, m.t.minute, m.text])).toEqual([
      ['강민서', 15, 4, '안녕'], ['서지안', 15, 10, '저도 지금 봤어요'],
    ]);
  });

  it('iOS 형식', () => {
    const c = parseKakaoText(ios, 'c.txt');
    expect(c.format).toBe('ios');
    expect(c.savedDate).toBe('2026-08-31');
    expect(c.messages[1]).toMatchObject({ sender: '문영자', text: '절대 걱정 마' });
    expect(c.messages[1].t.hour).toBe(11);
  });

  it('"나" 기본값은 가장 많은 대화 파일에 나온 사람', () => {
    const chats = [parseKakaoText(pc, 'a'), parseKakaoText(pc.replace(/김서연/g, '박준호'), 'b')];
    expect(participants(chats)[0].name).toBe('한도윤');
  });

  it('카카오톡 판별과 1인칭·단정어 규칙', () => {
    expect(looksLikeKakao(pc)).toBe(true);
    expect(looksLikeKakao('그냥 메모 파일입니다')).toBe(false);
    expect(isFirstPerson('나는 괜찮아')).toBe(true);
    expect(isFirstPerson('"제가," 할게요')).toBe(true);
    expect(isFirstPerson('나무가 크다')).toBe(false);
    expect(isFirstPerson('저기 봐')).toBe(false);
    expect(isAssertive('그건 무조건이지')).toBe(true);
  });
});

describe('유튜브', () => {
  it('한국어·영어 제목, 광고 제외, UTC → 한국 시간', () => {
    const agg = new Aggregator();
    const ko = [
      { title: 'a을(를) 시청했습니다.', time: '2023-01-01T16:30:00.000Z' }, // 한국 1/2 01:30 새벽
      { title: '광고을(를) 시청했습니다.', time: '2023-01-01T16:31:00Z', details: [{ name: 'Google 광고' }] },
    ];
    const en = [{ title: 'Watched b', time: '2023-01-02T03:00:00Z' }, { title: 'Ad', time: '2023-01-02T03:01:00Z', details: [{ name: 'From Google Ads' }] }];
    expect(parseYouTube(JSON.stringify(ko), 'watch', agg)).toBe(1);
    expect(parseYouTube(JSON.stringify(en), 'watch', agg)).toBe(1);
    expect(parseYouTube(JSON.stringify([{ title: 'Searched for c', time: '2023-01-02T14:59:59Z' }]), 'search', agg)).toBe(1);
    expect(rows(agg)['2023-01-02']).toMatchObject({ yt_watch_n: 2, yt_watch_night_n: 1, yt_search_n: 1 });
  });
});

describe('캘린더', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:a', 'DTSTART:20240105T150000Z', 'SUMMARY:x', 'END:VEVENT', // 한국 1/6 00:00
    'BEGIN:VEVENT', 'UID:b', 'DTSTART;VALUE=DATE:20240110', 'SUMMARY:y', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:c', 'DTSTART;TZID=Asia/Seoul:20240103T190000', 'RRULE:FREQ=WEEKLY;UNTIL=20240124T145900Z',
    'EXDATE;TZID=Asia/Seoul:20240110T190000', 'SUMMARY:z', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:d', 'DTSTART:20240101T010000Z', 'RRULE:FREQ=WEEKLY', 'SUMMARY:inf', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:e', 'DTSTART:20240102T010000Z', 'STATUS:CANCELLED', 'SUMMARY:c', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  it('UTC·TZID·종일 일정, UNTIL 당일 포함, EXDATE 제외, 끝없는 반복은 마지막 일반 일정까지', () => {
    const agg = new Aggregator();
    // c: 1/3, 1/17, 1/24 (1/10 제외) = 3건. d: 1/1, 1/8 (마지막 일반 일정 1/10 까지) = 2건. a, b = 2건
    expect(parseCalendar(ics, agg)).toBe(7);
    const r = rows(agg);
    expect(r['2024-01-06']?.cal_n).toBe(1);
    expect(r['2024-01-24']?.cal_n).toBe(1);
    expect(r['2024-01-10']?.cal_n).toBe(1); // 종일 일정만(반복의 1/10 발생은 EXDATE)
    expect(r['2024-01-15']).toBeUndefined();
  });
});

describe('건강', () => {
  it('잠 세션: 90분 넘게 떨어지면 새 세션, 자정 전 구간도 깬 날짜로', () => {
    const t = (d: string, h: number, m = 0) => ({ date: d, hour: h, minute: m, ms: Date.parse(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`) });
    const s = sleepSessions([
      { start: t('2024-01-01', 23, 0), end: t('2024-01-01', 23, 50) },
      { start: t('2024-01-01', 23, 55), end: t('2024-01-02', 6, 0) },
      { start: t('2024-01-02', 14, 0), end: t('2024-01-02', 14, 30) },
    ]);
    expect(s).toEqual([{ date: '2024-01-02', minutes: 415 }, { date: '2024-01-02', minutes: 30 }]);
  });

  it('CSV 따옴표·빈 마지막 열', () => {
    expect(splitCsvLine('a,"{""x"":1,""y"":2}",b,')).toEqual(['a', '{"x":1,"y":2}', 'b', '']);
  });

  it('애플 건강 export.xml(약 50MB)을 조각 단위 스트림으로 읽는다', async () => {
    ensureSynth('long');
    const inp = exportInputs('long').find((i) => i.path === 'export.zip')!;
    const z = await openZip(inp);
    const xml = z.sources.find((s) => s.name === 'export.xml')!;
    expect(xml.size).toBeGreaterThan(45_000_000);
    const acc = new HealthAcc();
    const r = await parseAppleHealth(xml, acc);
    await z.close();
    expect(r.chunks).toBeGreaterThan(100); // 한 번에 올리지 않고 여러 조각으로 흘러왔다
    expect(r.records).toBeGreaterThan(100_000);
    expect(acc.exportDate).toBe('2026-09-01');
  }, 120000);
});

describe('경로 판별과 날짜', () => {
  it('Takeout 경로(한국어·영어), 건강, 사진, 사이드카', () => {
    expect(classify('Takeout/YouTube 및 YouTube Music/기록/시청 기록.json')).toBe('yt-watch');
    expect(classify('Takeout/YouTube and YouTube Music/history/search-history.json')).toBe('yt-search');
    expect(classify('Takeout/Keep/메모(1).json')).toBe('keep');
    expect(classify('Takeout/Keep/메모.html')).toBe('ignore');
    expect(classify('Takeout/캘린더/개인.ics')).toBe('ics');
    expect(classify('apple_health_export/export.xml')).toBe('apple-health');
    expect(classify('apple_health_export/export_cda.xml')).toBe('ignore');
    expect(classify('x/com.samsung.shealth.tracker.pedometer_day_summary.20260901101500.csv')).toBe('samsung-steps');
    expect(classify('x/com.samsung.health.sleep.20260901101500.csv')).toBe('samsung-sleep');
    expect(classify('x/com.samsung.health.sleep_stage.20260901101500.csv')).toBe('ignore');
    expect(classify('Takeout/Google 포토/Photos from 2019/IMG_1.jpg.supplemental-metadata.json')).toBe('photo-sidecar');
    expect(classify('photos/DCIM/2019/IMG_1001.JPG')).toBe('photo');
  });

  it('파일 이름 날짜와 ISO 주', () => {
    expect(nameDate('스크린샷 2025-01-12 오후 3.51.17.png')).toMatchObject({ date: '2025-01-12', hour: 15 });
    expect(nameDate('스크린샷 2025-01-12 오전 12.01.00.png')).toMatchObject({ hour: 0 });
    expect(nameDate('Screenshot_20190613-142233.png')).toMatchObject({ date: '2019-06-13', hour: 14 });
    expect(nameDate('IMG_20190613_142233_1.jpg')).toMatchObject({ date: '2019-06-13' });
    expect(nameDate('photo_01.jpg')).toBeNull();
    expect(isoWeek('2021-01-03')).toBe('2020-W53');
    expect(isoWeek('2026-08-31')).toBe('2026-W36');
    expect(isoWeek('2024-12-30')).toBe('2025-W01');
  });
});

describe('분할 Takeout', () => {
  it('long 은 zip 두 개에 나뉜 유튜브·메모(1번)와 캘린더·구글 포토(2번)를 함께 읽는다', async () => {
    ensureSynth('long');
    const inputs = exportInputs('long').filter((i) => i.path?.startsWith('takeout-'));
    expect(inputs.length).toBe(2);
    const r = await runImport(inputs);
    expect(Object.keys(r.meta.channels).sort()).toEqual(['cal', 'memo', 'photo', 'yt']);
    expect(r.photos.some((p) => p.source === 'takeout' && p.path.includes('-002.zip::'))).toBe(true);
    expect(r.files['yt-watch']).toBe(1);
    expect(r.files.ics).toBe(2);
  }, 120000);
});
