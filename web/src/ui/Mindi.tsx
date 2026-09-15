// 민디: 들어올 때 한 번만 먼저 말한다. 그다음은 사용자가 누를 때만 말한다.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { DONT_KNOW, GREETING, similarTemplate } from '../mindi/templates';
import { polishTone } from '../mindi/tone';
import { canSpeak, speak, stopSpeaking } from '../mindi/voice';
import { IconSpeaker, IconStop, MindiMark } from './Icons';
import type { WeekRecord } from '../types';

export function SpeakButton({ text }: { text: string }) {
  const { settings } = useStore();
  const [on, setOn] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!settings.voice || !canSpeak()) return null;
  return (
    <button
      className="btn quiet"
      aria-label={on ? '읽기 멈추기' : '소리 내어 읽기'}
      onClick={() => {
        if (on) { stopSpeaking(); setOn(false); return; }
        if (speak(text, () => setOn(false))) setOn(true);
      }}
    >
      {on ? <IconStop /> : <IconSpeaker />}
      {on ? '멈추기' : '읽어 주기'}
    </button>
  );
}

/** 가장 최근 관측 주(이번 주)와 가장 닮은 지난 주를 고른다. */
function latestWithSimilar(weeks: WeekRecord[]): WeekRecord | undefined {
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].similar?.length) return weeks[i];
  }
  return undefined;
}

export function MindiGreeting() {
  const { weeks, byKey, greeted, markGreeted, select, memosByWeek, settings } = useStore();
  const [answer, setAnswer] = useState<{ text: string; used: string; target: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  if (greeted && !answer && !busy) return null;

  async function go() {
    const cur = latestWithSimilar(weeks);
    markGreeted();
    if (!cur) {
      setAnswer({ text: '아직 비교할 만큼 기록이 쌓이지 않았습니다.', used: 'template', target: '' });
      return;
    }
    const best = cur.similar[0];
    const sim = byKey.get(best.week)!;
    const tpl = similarTemplate(cur, sim, best.same_direction, memosByWeek.get(sim.week)?.length ?? 0);
    setBusy(true);
    abort.current = new AbortController();
    const r = settings.tone ? await polishTone(tpl, abort.current.signal) : { text: tpl, used: 'template' as const };
    setBusy(false);
    setAnswer({ text: r.text, used: r.used, target: sim.week });
  }

  const say = answer ? answer.text : GREETING;
  return (
    <div className="mindi-panel" role="region" aria-label="민디">
      <div className="mindi">
        <MindiMark />
        <div>
          <p className="say">
            {say}
            {answer && answer.target && <> <span className="dk">{DONT_KNOW}</span></>}
          </p>
          <div className="row">
            {!answer && (
              <>
                <button className="btn primary" onClick={go} disabled={busy}>{busy ? '찾는 중' : '찾아가 보기'}</button>
                <button className="btn quiet" onClick={() => markGreeted()}>다음에</button>
              </>
            )}
            {answer && answer.target && (
              <button className="btn primary" onClick={() => { select(answer.target); setAnswer(null); }}>그 주 열어 보기</button>
            )}
            {answer && !answer.target && <button className="btn quiet" onClick={() => setAnswer(null)}>닫기</button>}
            <SpeakButton text={answer ? `${answer.text} ${answer.target ? DONT_KNOW : ''}` : GREETING} />
          </div>
          {answer?.used === 'llm' && <p className="small muted" style={{ marginTop: 8 }}>말투는 외부 모델이 다듬었습니다. 숫자와 날짜는 판정값 그대로입니다.</p>}
        </div>
      </div>
    </div>
  );
}
