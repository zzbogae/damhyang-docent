// 경로와 이름으로 원천 파일의 종류를 판별한다(규칙: docs/import_rules.md).

export type SourceKind =
  | 'yt-watch'
  | 'yt-search'
  | 'yt-watch-html'
  | 'yt-search-html'
  | 'fit-daily'
  | 'fit-session'
  | 'ig-content'
  | 'ig-message'
  | 'ig-profile'
  | 'ai-conversations'
  | 'keep'
  | 'ics'
  | 'apple-health'
  | 'samsung-steps'
  | 'samsung-sleep'
  | 'kakao' // .txt 는 내용 머리를 보고 최종 판단
  | 'photo'
  | 'photo-sidecar'
  | 'zip'
  | 'ignore';

const IMG_RE = /\.(jpe?g|png|heic|heif|webp|gif)$/i;

export function classify(inner: string): SourceKind {
  const p = inner.normalize('NFC');
  const lower = p.toLowerCase();
  const name = p.slice(p.lastIndexOf('/') + 1);
  if (/\.zip$/i.test(name)) return 'zip';
  if (/(^|\/)youtube[^/]*\/(history|기록)\/(watch-history|시청 기록)\.json$/i.test(p)) return 'yt-watch';
  if (/(^|\/)youtube[^/]*\/(history|기록)\/(search-history|검색 기록)\.json$/i.test(p)) return 'yt-search';
  if (/(^|\/)youtube[^/]*\/(history|기록)\/(watch-history|시청 기록)\.html?$/i.test(p)) return 'yt-watch-html';
  if (/(^|\/)youtube[^/]*\/(history|기록)\/(search-history|검색 기록)\.html?$/i.test(p)) return 'yt-search-html';
  // 구글 피트니스: 일일 활동 측정항목 CSV(날짜별 파일 말고 합계 파일), 세션 JSON(수면)
  if (/(^|\/)(fit|피트니스)\/(daily activity metrics|일일 활동 측정항목|일일 활동 측정 항목)\/[^/]*(daily activity metrics|일일 활동 측정항목|일일 활동 측정 항목)[^/]*\.csv$/i.test(p)) return 'fit-daily';
  if (/(^|\/)(fit|피트니스)\/(all sessions|모든 세션)\/[^/]+\.json$/i.test(p)) return 'fit-session';
  // 인스타그램 내 정보 다운로드(JSON): 게시물·스토리·릴스, DM, 프로필. 올린 사진 파일(media/…)은 사진 채널에 넣지 않는다(카메라 사진과 겹침)
  if (/(^|\/)(your_instagram_activity\/)?content\/(posts_\d+|stories|reels)\.json$/i.test(p)) return 'ig-content';
  if (/(^|\/)(your_instagram_activity\/)?messages\/inbox\/[^/]+\/message_\d+\.json$/i.test(p)) return 'ig-message';
  if (/(^|\/)personal_information\/(personal_information\/)?personal_information\.json$/i.test(p)) return 'ig-profile';
  if (/(^|\/)media\/(posts|stories|reels|other|profile)\//i.test(p) && IMG_RE.test(name)) return 'ignore';
  // AI 대화 내보내기(ChatGPT·Claude)
  if (/(^|\/)conversations\.json$/i.test(p)) return 'ai-conversations';
  if (/(^|\/)keep\/[^/]+\.json$/i.test(p)) return 'keep';
  if (/\.ics$/i.test(name)) return 'ics';
  if (/^export\.xml$/i.test(name)) return 'apple-health';
  if (/pedometer_day_summary\.[^/]*\.csv$/i.test(name)) return 'samsung-steps';
  if (/\.sleep\.\d{6,}\.csv$/i.test(name)) return 'samsung-sleep';
  if (/\.txt$/i.test(name)) return 'kakao';
  if (IMG_RE.test(name)) return 'photo';
  if (/\.(jpe?g|png|heic|heif|webp|gif)(\.[^/]*)?\.json$/i.test(lower)) return 'photo-sidecar';
  return 'ignore';
}

/** 카카오톡 내보내기 txt 인지 앞부분으로 확인한다. */
export function looksLikeKakao(head: string): boolean {
  const lines = head.split(/\r?\n/).slice(0, 12);
  if (lines.some((l) => /님과 카카오톡 대화/.test(l))) return true;
  return lines.some(
    (l) =>
      /^\[[^\]]+\] \[(오전|오후) \d{1,2}:\d{2}\] /.test(l) ||
      /^\d{4}년 \d{1,2}월 \d{1,2}일 (오전|오후) \d{1,2}:\d{2}, .+ : /.test(l) ||
      /^\d{4}\. \d{1,2}\. \d{1,2}\. (오전|오후) \d{1,2}:\d{2}, .+ : /.test(l),
  );
}
