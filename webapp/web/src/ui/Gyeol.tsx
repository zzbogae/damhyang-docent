// 결(줄무늬, 팀 9/15): 4축 중 몇 축이 평소 밴드(|z| < 1) 밖이었는지를 코어 단면의 줄무늬로 그린다. 광물(얼마나 드문가)과 따로다.
// 축 값은 축 안 지표 z 의 중앙값(대표값)이라, 지표 하나만 크게 벗어난 판정 주도 고른 결일 수 있다. 그래서 「대표값」이라고 적는다.
import type { Gyeol as G } from '../types';

export const GYEOL_TEXT: Record<G, { name: string; what: string }> = {
  regular: { name: '고른 결', what: '네 축의 대표값이 모두 평소 범위 안' },
  coarse: { name: '굵은 결', what: '한 축의 대표값이 평소 범위 밖' },
  mixed: { name: '섞인 결', what: '두 축 이상의 대표값이 평소 범위 밖' },
};

// 줄무늬 두께(위에서 아래로, 합 40). 같은 결은 언제나 같은 무늬다(난수 없음)
const BANDS: Record<G, number[]> = {
  regular: [5, 5, 5, 5, 5, 5, 5, 5],
  coarse: [5, 5, 15, 5, 5, 5],
  mixed: [3, 9, 2, 6, 11, 2, 7],
};

export function GyeolMark({ g, size = 22 }: { g: G; size?: number }) {
  let y = 0;
  return (
    <svg width={size * 0.55} height={size} viewBox="0 0 22 40" aria-hidden="true" className="gyeol-mark">
      {BANDS[g].map((h, i) => {
        const r = <rect key={i} x="0" y={y} width="22" height={h} fill={i % 2 ? '#c8bba8' : '#6f6977'} />;
        y += h;
        return r;
      })}
    </svg>
  );
}

export function GyeolChip({ g }: { g: G }) {
  const t = GYEOL_TEXT[g];
  return <span className="chip" title={t.what}><GyeolMark g={g} size={16} />{t.name}<small className="muted"> · {t.what}</small></span>;
}
