// 가져오기 진입점: 파일 여러 개 → 일 단위 표·채널 메타·메모·사진 색인.
// 규칙은 docs/import_rules.md. 카카오톡·유튜브·캘린더 원문은 남기지 않는다.
import type { Channel, DailyMeta, DailyRow, MemoRecord, PhotoRecord } from '../types';
import { Aggregator } from './aggregate';
import { utcMsToLocal } from './dates';
import { parseCalendar } from './parsers/calendar';
import { HealthAcc, parseAppleHealth, parseSamsungSleep, parseSamsungSteps } from './parsers/health';
import { aggregateKakao, type KakaoChat, type KakaoParticipant, parseKakaoText, participants } from './parsers/kakao';
import { parseKeep } from './parsers/keep';
import { indexPhoto, parseSidecar, type Sidecar } from './parsers/photos';
import { parseYouTube } from './parsers/youtube';
import { parseYouTubeHtml } from './parsers/youtubeHtml';
import { parseFitDaily, parseFitSession } from './parsers/fit';
import { InstagramAcc } from './parsers/instagram';
import { parseAiConversations } from './parsers/aichat';
import { classify, looksLikeKakao, type SourceKind } from './router';
import { fileSource, type ImportInput, inputPath, isZipName, type OpenedZip, openZip, type SourceFile } from './sources';

export type { ImportInput } from './sources';

export interface ImportOptions {
  /** 카카오톡에서 "나"로 볼 참여자 이름. 없으면 가장 많이 등장한 사람 */
  kakaoMe?: string;
}

export interface ImportProgress {
  phase: 'scan' | 'read' | 'photos' | 'done';
  filesDone: number;
  filesTotal: number;
  file?: string;
  records: Partial<Record<Channel, number>>;
}

export interface ImportResult {
  daily: DailyRow[];
  meta: DailyMeta;
  memos: MemoRecord[];
  photos: PhotoRecord[];
  kakaoParticipants: KakaoParticipant[];
  kakaoMe?: string;
  /** 종류별로 읽은 파일 수 */
  files: Partial<Record<SourceKind, number>>;
  skipped: number;
  warnings: string[];
}

function dirOf(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i) : '';
}

function takeoutExportDate(zipName: string): string | null {
  const m = /takeout-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/i.exec(zipName);
  if (!m) return null;
  return utcMsToLocal(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).date;
}

function photoSource(src: SourceFile): PhotoRecord['source'] {
  if (src.container && /(^|\/)Takeout\/Google (포토|Photos)\//i.test(src.inner)) return 'takeout';
  if (src.container || src.inner.includes('/')) return 'folder';
  return 'file';
}

export async function runImport(
  inputs: ImportInput[],
  opts: ImportOptions = {},
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportResult> {
  const agg = new Aggregator();
  const zips: OpenedZip[] = [];
  const sources: { src: SourceFile; kind: SourceKind }[] = [];
  const warnings: string[] = [];
  const files: Partial<Record<SourceKind, number>> = {};
  const records: Partial<Record<Channel, number>> = {};
  let skipped = 0;

  // 1) 파일과 zip 항목을 모은다
  for (const inp of inputs) {
    const name = inputPath(inp);
    if (isZipName(name)) {
      try {
        const z = await openZip(inp);
        zips.push(z);
        agg.addExportDate(takeoutExportDate(name));
        for (const s of z.sources) sources.push({ src: s, kind: classify(s.inner) });
      } catch (e) {
        warnings.push(`zip 을 열지 못했습니다: ${name}`);
      }
    } else {
      const s = fileSource(inp);
      sources.push({ src: s, kind: classify(s.inner) });
    }
  }
  const total = sources.length;
  let done = 0;
  let lastPhase: ImportProgress['phase'] = 'scan';
  const tick = (file?: string, phase: ImportProgress['phase'] = 'read') => {
    done++;
    // 워커→화면 메시지가 너무 많아지지 않게 25개마다, 단계가 바뀔 때, 마지막에만 알린다
    if (onProgress && (done % 25 === 0 || done === total || phase !== lastPhase)) {
      onProgress({ phase, filesDone: done, filesTotal: total, file, records: { ...records } });
    }
    lastPhase = phase;
  };
  onProgress?.({ phase: 'scan', filesDone: 0, filesTotal: total, records: {} });
  const bump = (c: Channel, n: number) => { records[c] = (records[c] ?? 0) + n; };

  // 2) 사진 사이드카(Google 포토)를 먼저 읽어 둔다: 폴더 + 원래 파일 이름 → 촬영 시각
  const sidecars = new Map<string, Sidecar>();
  for (const { src, kind } of sources) {
    if (kind !== 'photo-sidecar') continue;
    const sc = parseSidecar(await src.text());
    if (sc) sidecars.set(`${src.container ?? ''}::${dirOf(src.inner)}/${sc.title}`, sc);
    files[kind] = (files[kind] ?? 0) + 1;
    tick(src.path);
  }

  // 3) 채널별 파서
  const memos: MemoRecord[] = [];
  const photos: PhotoRecord[] = [];
  const health = new HealthAcc();
  const ig = new InstagramAcc();
  const chats: KakaoChat[] = [];
  const photoSrcs: SourceFile[] = [];
  for (const { src, kind } of sources) {
    try {
      switch (kind) {
        case 'yt-watch':
        case 'yt-search':
          bump('yt', parseYouTube(await src.text(), kind === 'yt-watch' ? 'watch' : 'search', agg));
          break;
        case 'yt-watch-html':
        case 'yt-search-html':
          bump('yt', await parseYouTubeHtml(src, kind === 'yt-watch-html' ? 'watch' : 'search', agg, (w) => warnings.push(w)));
          break;
        case 'fit-daily':
          bump('health', parseFitDaily(await src.text(), health));
          break;
        case 'fit-session':
          bump('health', parseFitSession(await src.text(), health));
          break;
        case 'ig-content':
          ig.addContent(await src.text());
          break;
        case 'ig-message':
          ig.addMessages(await src.text(), `${src.container ?? ''}::${dirOf(src.inner)}`);
          break;
        case 'ig-profile':
          ig.addProfile(await src.text());
          break;
        case 'ai-conversations': {
          const r = parseAiConversations(await src.text(), agg);
          if (!r.app) { skipped++; tick(src.path); continue; }
          bump('ai', r.messages);
          break;
        }
        case 'keep': {
          const m = parseKeep(await src.text(), src.inner, agg);
          if (m) { memos.push(m); bump('memo', 1); }
          break;
        }
        case 'ics':
          bump('cal', parseCalendar(await src.text(), agg));
          break;
        case 'apple-health': {
          const r = await parseAppleHealth(src, health);
          bump('health', r.records);
          break;
        }
        case 'samsung-steps':
          bump('health', parseSamsungSteps(await src.text(), health));
          break;
        case 'samsung-sleep':
          bump('health', parseSamsungSleep(await src.text(), health));
          break;
        case 'kakao': {
          const text = await src.text();
          if (!looksLikeKakao(text.slice(0, 4000))) { skipped++; tick(src.path); continue; }
          chats.push(parseKakaoText(text, src.name));
          break;
        }
        case 'photo':
          photoSrcs.push(src);
          continue; // 사진은 아래에서 따로 센다
        case 'photo-sidecar':
          continue;
        default:
          skipped++;
          tick(src.path);
          continue;
      }
      files[kind] = (files[kind] ?? 0) + 1;
    } catch (e) {
      warnings.push(`읽지 못한 파일: ${src.path} (${(e as Error)?.message ?? e})`);
    }
    tick(src.path);
  }
  health.flush(agg);
  bump('sns', ig.flush(agg));

  // 4) 카카오톡: "나"를 정하고 집계
  const parts = participants(chats);
  const me = opts.kakaoMe ?? parts[0]?.name;
  if (me && chats.length) bump('kakao', aggregateKakao(chats, me, agg));
  if (chats.length) files.kakao = chats.length;

  // 5) 사진 색인
  // 폴더에서 고른 사진은 EXIF 앞부분만 읽으므로 8장씩 동시에 읽는다(2만 장 규모). zip 안의 사진은 차례로 읽는다.
  let noDate = 0;
  const one = async (src: SourceFile) => {
    const source = photoSource(src);
    const sc = sidecars.get(`${src.container ?? ''}::${dirOf(src.inner)}/${src.name}`);
    const rec = await indexPhoto(src, source, sc, agg);
    if (rec) {
      photos.push(rec);
      bump('photo', 1);
    } else noDate++;
    files.photo = (files.photo ?? 0) + 1;
    tick(src.path, 'photos');
  };
  const loose = photoSrcs.filter((x) => !x.container);
  const zipped = photoSrcs.filter((x) => x.container);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, loose.length) }, async () => {
    while (next < loose.length) await one(loose[next++]);
  }));
  for (const src of zipped) await one(src);
  if (noDate) warnings.push(`찍은 날짜를 알 수 없어 건너뛴 사진 ${noDate}장`);

  for (const z of zips) await z.close().catch(() => undefined);
  const { daily, meta } = agg.finalize();
  onProgress?.({ phase: 'done', filesDone: total, filesTotal: total, records: { ...records } });
  memos.sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id));
  photos.sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.path.localeCompare(b.path));
  return { daily, meta, memos, photos, kakaoParticipants: parts, kakaoMe: me, files, skipped, warnings };
}
