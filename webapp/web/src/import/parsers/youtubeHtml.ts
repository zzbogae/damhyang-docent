// 유튜브 시청·검색 기록(Google Takeout HTML 형식). Takeout 의 유튜브 기록 기본 형식이 HTML 이라,
// 사용자가 JSON 으로 바꾸지 않아도 읽히게 한다. 워커 안에서 돌기 때문에 DOMParser 를 쓰지 않고,
// 텍스트를 조각으로 받아 항목(outer-cell) 단위로 잘라 읽는다(파일 전체를 메모리에 올리지 않음).
// 규칙은 JSON 파서와 같다: 광고·설문 항목 제외, 한국 벽시계 시각 기준 집계, 제목 원문은 저장하지 않음.
import type { Aggregator } from '../aggregate';
import { hour24, type LocalTime, utcMsToLocal, wall } from '../dates';
import type { SourceFile } from '../sources';
import { addYouTubeEvent, isSurveyTitle, YT_AD_RE } from './youtube';

const CELL_START = '<div class="outer-cell';

const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
/** 표준시 약어 → UTC 와의 차이(분). 표에 없으면 한국 시간으로 본다(경고에 남김). */
const TZ_OFFSET_MIN: Record<string, number> = {
  KST: 540, JST: 540, UTC: 0, GMT: 0, PST: -480, PDT: -420, MST: -420, MDT: -360, CST: -360, CDT: -300,
  EST: -300, EDT: -240, CET: 60, CEST: 120, BST: 60, AEST: 600, AEDT: 660, SGT: 480, HKT: 480,
};

const KO_DATE = /(\d{4})\. ?(\d{1,2})\. ?(\d{1,2})\.? ?(오전|오후) ?(\d{1,2}):(\d{2}):(\d{2})(?: ?([A-Z]{2,5}|GMT[+-]\d{1,2}(?::\d{2})?))?/;
const EN_DATE = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}):(\d{2})[\s  ]?(AM|PM)(?:[\s  ]([A-Z]{2,5}|GMT[+-]\d{1,2}(?::\d{2})?))?/;

function decodeEntities(s: string): string {
  return s
    .replace(/&emsp;|&ensp;|&nbsp;|&#160;|&#8239;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'");
}

function textLines(html: string): string[] {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .split('\n').map((x) => x.trim()).filter(Boolean);
}

function tzOffset(tz: string | undefined, warn: (s: string) => void): number {
  if (!tz) return 540;
  const g = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tz);
  if (g) return (g[1] === '-' ? -1 : 1) * (Number(g[2]) * 60 + Number(g[3] ?? 0));
  if (tz in TZ_OFFSET_MIN) return TZ_OFFSET_MIN[tz];
  warn(`유튜브 HTML 의 시간대 ${tz} 를 몰라 한국 시간으로 읽었습니다`);
  return 540;
}

/** HTML 날짜 줄 → 한국 벽시계 시각. 표시된 시간대가 한국이 아니면 한국 시각으로 옮긴다. */
export function parseHtmlDate(line: string, warn: (s: string) => void = () => undefined): LocalTime | null {
  let y: number, mo: number, d: number, h: number, mi: number, se: number, tz: string | undefined;
  const k = KO_DATE.exec(line);
  if (k) {
    y = +k[1]; mo = +k[2]; d = +k[3]; h = hour24(k[4], +k[5]); mi = +k[6]; se = +k[7]; tz = k[8];
  } else {
    const e = EN_DATE.exec(line);
    if (!e || !(e[1] in MONTHS)) return null;
    mo = MONTHS[e[1]]; d = +e[2]; y = +e[3]; h = hour24(e[7], +e[4]); mi = +e[5]; se = +e[6]; tz = e[8];
  }
  const off = tzOffset(tz, warn);
  if (off === 540) return wall(y, mo, d, h, mi, se);
  return utcMsToLocal(Date.UTC(y, mo - 1, d, h, mi, se) - off * 60000);
}

export interface HtmlParseStats { items: number; ads: number; surveys: number; undated: number }

/** 조각 단위 파서: push 로 텍스트를 넣고 end 로 마무리한다. */
export class YouTubeHtmlParser {
  private buf = '';
  readonly stats: HtmlParseStats = { items: 0, ads: 0, surveys: 0, undated: 0 };
  private warned = new Set<string>();
  constructor(private kind: 'watch' | 'search', private agg: Aggregator, private warn: (s: string) => void = () => undefined) {}

  private note = (s: string) => { if (!this.warned.has(s)) { this.warned.add(s); this.warn(s); } };

  push(chunk: string) {
    this.buf += chunk;
    let start = this.buf.indexOf(CELL_START);
    if (start < 0) {
      // 항목 시작이 없으면 끝부분만 남겨 다음 조각과 이어 붙인다
      if (this.buf.length > CELL_START.length) this.buf = this.buf.slice(-CELL_START.length);
      return;
    }
    for (;;) {
      const next = this.buf.indexOf(CELL_START, start + CELL_START.length);
      if (next < 0) break;
      this.cell(this.buf.slice(start, next));
      start = next;
    }
    this.buf = this.buf.slice(start);
  }

  end() {
    const i = this.buf.indexOf(CELL_START);
    if (i >= 0) this.cell(this.buf.slice(i));
    this.buf = '';
    return this.stats;
  }

  private cell(html: string) {
    // 첫 번째 본문 칸(content-cell ... body-1)과 캡션 칸(caption)을 나눈다
    const bodyM = /<div class="content-cell[^"]*body-1[^"]*">([\s\S]*?)<\/div>/.exec(html);
    if (!bodyM) return;
    const capM = /<div class="content-cell[^"]*caption[^"]*">([\s\S]*?)<\/div>/.exec(html);
    const lines = textLines(bodyM[1]);
    if (!lines.length) return;
    if (capM && YT_AD_RE.test(textLines(capM[1]).join(' '))) { this.stats.ads++; return; }
    if (isSurveyTitle(lines[0])) { this.stats.surveys++; return; }
    let t: LocalTime | null = null;
    for (let i = lines.length - 1; i >= 0 && !t; i--) t = parseHtmlDate(lines[i], this.note);
    if (!t) { this.stats.undated++; return; }
    addYouTubeEvent(this.agg, this.kind, t);
    this.stats.items++;
  }
}

/** 원천 파일을 스트림으로 흘려 읽는다. */
export async function parseYouTubeHtml(src: SourceFile, kind: 'watch' | 'search', agg: Aggregator, warn: (s: string) => void): Promise<number> {
  const p = new YouTubeHtmlParser(kind, agg, warn);
  const dec = new TextDecoder('utf-8');
  await src.pipe(new WritableStream<Uint8Array>({
    write(chunk) { p.push(dec.decode(chunk, { stream: true })); },
    close() { p.push(dec.decode()); },
  }));
  const s = p.end();
  if (s.undated) warn(`유튜브 HTML 에서 날짜를 읽지 못한 항목 ${s.undated}개를 건너뛰었습니다`);
  return s.items;
}
