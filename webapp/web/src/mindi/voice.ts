// 민디 목소리: 브라우저 내장 음성 합성(기기 안에서 처리). 한국어 음성이 없으면 조용히 건너뛴다.
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function koVoice(): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis.getVoices();
  return vs.find((v) => v.lang?.toLowerCase().startsWith('ko')) ?? undefined;
}

export function speak(text: string, onEnd?: () => void): boolean {
  if (!canSpeak()) return false;
  const v = koVoice();
  if (!v) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = 0.95;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
