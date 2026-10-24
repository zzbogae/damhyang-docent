// 연도가 쌓이는 장면(엘리베이터 하강 중): 가장 최근 해부터 고른 해까지, 한 해에 한 겹씩 아래로 쌓인다.
// 지나간 해는 위로 밀려 흐려지고, 도착한 해는 등불빛으로 남는다. 「깊이 = 시간」 — 위가 최근, 아래가 오래된 해.
// 날짜를 아무 데나 띄우지 않고 한 줄로만 쌓는다(기원영상 40초 장면의 흩어진 날짜를 대신함).
// 연출 줄이기(OS 설정)에서는 엘리베이터가 하강 연출 없이 넘어가므로 이 장면도 나오지 않는다.
import type { CSSProperties } from 'react';
import './year-stack.css';

export function YearStack({ years, sec }: { years: number[]; sec: number }) {
  const n = years.length;
  // 마지막 해가 하강이 끝나기 조금 전에 자리 잡도록
  const span = Math.max(0, sec - 0.7);
  const step = n > 1 ? span / (n - 1) : 0;
  return (
    <div className="ys" aria-hidden="true" style={{ '--ys-rows': n - 1, '--ys-span': `${span}s` } as CSSProperties}>
      <ol className="ys-col">
        {years.map((y, i) => (
          <li key={y} className={`ys-row${i === n - 1 ? ' last' : ''}`}
            style={{ '--ys-in': `${(i * step).toFixed(2)}s`, '--ys-out': `${((i + 1) * step).toFixed(2)}s` } as CSSProperties}>
            <span className="ys-year">{y}</span>
            <i className="ys-seam" />
          </li>
        ))}
      </ol>
    </div>
  );
}
