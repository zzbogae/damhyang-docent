// 유튜브 Takeout HTML(한국어·영어 날짜 줄, 시간대, 광고·설문 제외, 조각 경계)과 구글 피트니스 CSV·세션.
import { describe, expect, it } from 'vitest';
import { Aggregator } from '../src/import/aggregate';
import { parseHtmlDate, YouTubeHtmlParser } from '../src/import/parsers/youtubeHtml';
import { parseFitDaily, parseFitSession } from '../src/import/parsers/fit';
import { HealthAcc } from '../src/import/parsers/health';
import { classify } from '../src/import/router';

const cell = (body: string, cap = '<b>제품:</b><br>&emsp;YouTube<br>') =>
  `<div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp"><div class="mdl-grid"><div class="header-cell mdl-cell mdl-cell--12-col"><p class="mdl-typography--title">YouTube<br></p></div><div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">${body}</div><div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1 mdl-typography--text-right"></div><div class="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption">${cap}</div></div></div>`;

describe('유튜브 HTML', () => {
  it('한국어·영어 날짜 줄과 시간대', () => {
    expect(parseHtmlDate('2023. 1. 1. 오후 3:04:05 KST')).toMatchObject({ date: '2023-01-01', hour: 15, minute: 4 });
    expect(parseHtmlDate('2023. 1. 1. 오전 12:10:00 KST')).toMatchObject({ date: '2023-01-01', hour: 0 });
    expect(parseHtmlDate('Jan 1, 2023, 3:04:05 PM KST')).toMatchObject({ date: '2023-01-01', hour: 15 });
    // UTC 로 적힌 줄은 한국 시간으로 옮긴다(+9)
    expect(parseHtmlDate('Dec 31, 2022, 8:30:00 PM UTC')).toMatchObject({ date: '2023-01-01', hour: 5, minute: 30 });
    expect(parseHtmlDate('아무 날짜 아님')).toBeNull();
  });

  it('광고·설문을 빼고, 조각 경계에 걸린 항목도 한 번씩만 센다', () => {
    const html = '<html><body><div class="mdl-grid">' +
      cell('<a href="https://www.youtube.com/watch?v=a">영상 하나</a>을(를) 시청했습니다.<br><a href="https://www.youtube.com/channel/x">채널</a><br>2024. 3. 5. 오전 2:10:00 KST<br>') +
      cell('<a href="https://www.youtube.com/watch?v=b">광고 영상</a>을(를) 시청했습니다.<br>2024. 3. 5. 오후 1:00:00 KST<br>', '<b>제품:</b><br>&emsp;YouTube<br><b>세부정보:</b><br>&emsp;Google 광고<br>') +
      cell('설문조사 질문에 답변함<br>2024. 3. 5. 오후 2:00:00 KST<br>') +
      cell('<a href="https://www.youtube.com/watch?v=c">영상 둘</a>을(를) 시청했습니다.<br>2024. 3. 6. 오후 9:00:00 KST<br>') +
      '</div></body></html>';
    for (const size of [7, 64, 1000, html.length]) {
      const agg = new Aggregator();
      const p = new YouTubeHtmlParser('watch', agg);
      for (let i = 0; i < html.length; i += size) p.push(html.slice(i, i + size));
      const st = p.end();
      expect(st).toMatchObject({ items: 2, ads: 1, surveys: 1 });
      const { daily } = agg.finalize();
      expect(daily).toEqual([{ date: '2024-03-05', yt_watch_n: 1, yt_watch_night_n: 1 }, { date: '2024-03-06', yt_watch_n: 1 }]);
    }
  });

  it('10만 항목을 조각으로 흘려 읽는다(속도)', () => {
    const one = cell('<a href="https://www.youtube.com/watch?v=q">가상 영상 제목이 조금 긴 편입니다</a>을(를) 시청했습니다.<br><a href="https://www.youtube.com/channel/x">가상 채널</a><br>2024. 3. 5. 오후 3:04:05 KST<br>');
    const n = 100_000;
    const agg = new Aggregator();
    const p = new YouTubeHtmlParser('watch', agg);
    const chunk = one.repeat(500);
    const t = performance.now();
    for (let i = 0; i < n / 500; i++) p.push(chunk);
    const st = p.end();
    const ms = performance.now() - t;
    console.log(`유튜브 HTML ${n.toLocaleString()}항목 ${(one.length * n / 1048576).toFixed(0)}MB: ${Math.round(ms)}ms`);
    expect(st.items).toBe(n);
    expect(ms).toBeLessThan(20000);
  });

  it('경로 판별', () => {
    expect(classify('Takeout/YouTube 및 YouTube Music/기록/시청 기록.html')).toBe('yt-watch-html');
    expect(classify('Takeout/YouTube and YouTube Music/history/search-history.html')).toBe('yt-search-html');
    expect(classify('Takeout/Fit/Daily activity metrics/Daily activity metrics.csv')).toBe('fit-daily');
    expect(classify('Takeout/Fit/Daily activity metrics/2020-03-02.csv')).toBe('ignore');
    expect(classify('Takeout/피트니스/일일 활동 측정항목/일일 활동 측정항목.csv')).toBe('fit-daily');
    expect(classify('Takeout/Fit/All Sessions/2020-03-02T00_46_00+09_00_SLEEP.json')).toBe('fit-session');
  });
});

describe('구글 피트니스', () => {
  it('영어·한국어 머리글에서 걸음수를 읽고, 수면 세션만 잠으로 넣는다', () => {
    const h = new HealthAcc();
    expect(parseFitDaily('Date,Move Minutes count,Calories (kcal),Step count\n2024-03-05,40,300.5,8123\n2024-03-06,10,100,\n', h)).toBe(1);
    expect(parseFitDaily('﻿날짜,이동 시간(분),걸음 수\n2024-03-07,20,4500\n', h)).toBe(1);
    expect(parseFitSession(JSON.stringify({ fitnessActivity: 'sleep', startTime: '2024-03-06T14:00:00.000Z', endTime: '2024-03-06T21:30:00.000Z' }), h)).toBe(1);
    expect(parseFitSession(JSON.stringify({ fitnessActivity: 'walking', startTime: '2024-03-06T01:00:00.000Z', endTime: '2024-03-06T01:30:00.000Z' }), h)).toBe(0);
    const agg = new Aggregator();
    h.flush(agg);
    const { daily } = agg.finalize();
    expect(daily).toEqual([
      { date: '2024-03-05', steps: 8123 },
      { date: '2024-03-07', sleep_min: 450, steps: 4500 },
    ]);
  });
});
