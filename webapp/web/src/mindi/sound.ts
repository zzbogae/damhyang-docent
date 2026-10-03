// 민디 소리(팀 9/23 §1-8): 알아들을 수 없는 짧은 음절. 기기 안 Web Audio 로 합성하고 파일·외부 요청이 없다.
// 반응해도 되는 것은 사건 세 가지(찾았다·기다린다·채굴 성공)뿐이다. 그 주가 어떤 주였는지·답이 무엇인지에 따라
// 소리가 달라지면 그 소리가 판정이 되므로, 같은 사건에는 언제나 같은 소리를 낸다(난수 없음). 기본은 꺼짐.
export type MindiCue = 'found' | 'wait' | 'mined';

// 음절 하나 = [시작 음높이(Hz), 끝 음높이, 길이(초), 모음 색(두 번째 진동자 배수)]
type Syl = [number, number, number, number];
const CUES: Record<MindiCue, Syl[]> = {
  found: [[520, 640, 0.09, 2.1], [610, 760, 0.08, 2.6], [700, 980, 0.12, 2.3]],
  wait: [[420, 380, 0.14, 1.8], [400, 360, 0.18, 1.9]],
  mined: [[640, 900, 0.07, 2.8], [880, 1180, 0.07, 3.1], [1180, 1320, 0.16, 2.4]],
};

let ctx: AudioContext | null = null;

export function canPlay() {
  return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);
}

/** 사건 하나의 음절 목록(시험용으로 밖에 낸다) */
export const cueSyllables = (c: MindiCue) => CUES[c];

export function playCue(c: MindiCue, volume = 0.18) {
  if (!canPlay()) return;
  ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
  const ac = ctx;
  let t = ac.currentTime + 0.02;
  for (const [f0, f1, dur, vowel] of CUES[c]) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(ac.destination);
    for (const [mul, type, amp] of [[1, 'triangle', 1], [vowel, 'sine', 0.35]] as const) {
      const o = ac.createOscillator();
      const og = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0 * mul, t);
      o.frequency.exponentialRampToValueAtTime(f1 * mul, t + dur);
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    t += dur + 0.035;
  }
}
