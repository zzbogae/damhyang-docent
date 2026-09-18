// 사진 색인: 찍은 날짜·시각과 카메라 정보만 읽는다. 사진 바이트는 저장하지 않는다.
import exifr from 'exifr';
import type { PhotoRecord } from '../../types';
import type { Aggregator } from '../aggregate';
import { hour24, isoWeek, type LocalTime, utcMsToLocal, wall } from '../dates';
import { isNight, SCREENSHOT_NAME_RE } from '../rules';
import type { SourceFile } from '../sources';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', gif: 'image/gif',
};

export function mimeOf(name: string): string {
  return MIME[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';
}

/** EXIF 날짜 문자열 "YYYY:MM:DD HH:MM:SS" → 현지 벽시계 */
function exifDate(v: unknown): LocalTime | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v.trim());
  if (!m || m[1] === '0000') return null;
  return wall(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
}

/** 파일 이름에 든 날짜(docs/import_rules.md 의 패턴) */
export function nameDate(name: string): LocalTime | null {
  let m = /Screenshot_(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/i.exec(name);
  if (m) return wall(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
  m = /스크린샷 (\d{4})-(\d{2})-(\d{2}) (오전|오후) (\d{1,2})\.(\d{2})\.(\d{2})/.exec(name);
  if (m) return wall(+m[1], +m[2], +m[3], hour24(m[4], +m[5]), +m[6], +m[7]);
  m = /(?:IMG_|^)(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(name);
  if (m) return wall(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
  return null;
}

export interface Sidecar { title: string; takenUtcSec: number }

export function parseSidecar(text: string): Sidecar | null {
  try {
    const j = JSON.parse(text);
    const ts = Number(j?.photoTakenTime?.timestamp);
    if (!j?.title || !Number.isFinite(ts)) return null;
    return { title: String(j.title).normalize('NFC'), takenUtcSec: ts };
  } catch {
    return null;
  }
}

interface ExifInfo { taken: LocalTime | null; make?: string; model?: string }

async function readExif(src: SourceFile, mime: string): Promise<ExifInfo | null> {
  try {
    const blob = await src.blob();
    // EXIF 는 파일 앞부분에 있다. JPEG·PNG 는 앞 128KB, HEIC 는 앞 1MB 만 읽는다.
    const head = await blob.slice(0, mime === 'image/heic' || mime === 'image/heif' ? 1 << 20 : 128 << 10).arrayBuffer();
    const e = await exifr.parse(head, {
      pick: ['DateTimeOriginal', 'CreateDate', 'Make', 'Model'],
      reviveValues: false,
      translateValues: false,
    });
    if (!e) return null;
    return {
      taken: exifDate(e.DateTimeOriginal) ?? exifDate(e.CreateDate),
      make: typeof e.Make === 'string' ? e.Make.trim() : undefined,
      model: typeof e.Model === 'string' ? e.Model.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export function isScreenshot(name: string, mime: string, exif: ExifInfo | null): boolean {
  if (exif?.make || exif?.model) return false;
  return mime === 'image/png' || SCREENSHOT_NAME_RE.test(name);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 사진 하나를 색인한다. Takeout(Google 포토)은 사이드카를 먼저, 나머지는 EXIF 를 먼저 본다.
 * 날짜를 찾지 못하면 null.
 */
export async function indexPhoto(
  src: SourceFile,
  source: PhotoRecord['source'],
  sidecar: Sidecar | undefined,
  agg: Aggregator,
): Promise<PhotoRecord | null> {
  const mime = mimeOf(src.name);
  let taken: LocalTime | null = null;
  let exif: ExifInfo | null = null;
  if (source === 'takeout' && sidecar) {
    taken = utcMsToLocal(sidecar.takenUtcSec * 1000);
  } else {
    exif = await readExif(src, mime);
    taken = exif?.taken ?? (sidecar ? utcMsToLocal(sidecar.takenUtcSec * 1000) : null);
  }
  if (!taken) taken = nameDate(src.name);
  if (!taken) return null;
  const shot = isScreenshot(src.name, mime, exif);
  if (!shot) {
    agg.add(taken.date, 'photo_n');
    if (isNight(taken.hour)) agg.add(taken.date, 'photo_night_n');
    agg.touch('photo', taken.date, source === 'takeout' ? 'takeout-photos' : 'folder');
  }
  return {
    id: `ph:${src.path}`,
    date: taken.date,
    week: isoWeek(taken.date),
    hour: taken.hour,
    minute: taken.minute,
    name: src.name,
    path: src.path,
    size: src.size,
    mime,
    source,
    hasExif: !!(exif && (exif.taken || exif.make || exif.model)),
    ...(exif?.make ? { make: exif.make } : {}),
    ...(exif?.model ? { model: exif.model } : {}),
  };
}

export function localStamp(t: LocalTime): string {
  return `${t.date}T${pad(t.hour)}:${pad(t.minute)}`;
}
